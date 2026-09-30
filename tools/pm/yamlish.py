"""A parser for the strict YAML subset used by docs/ROADMAP.yaml.

Supported: block mappings, block lists (including lists of mappings), comments, one-line
scalars (plain, "double" or 'single' quoted), [flow, lists] and {flow: mappings} on one line.
Not supported: anchors, tags, multi-line strings, multiple documents.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_INT = re.compile(r"^[-+]?\d+$")
_FLOAT = re.compile(r"^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$")


class YamlishError(ValueError):
    def __init__(self, message: str, line: int | None = None):
        super().__init__(f"line {line}: {message}" if line else message)
        self.line = line


@dataclass
class _Line:
    number: int
    indent: int
    text: str


def parse(text: str):
    lines = _significant_lines(text)
    if not lines:
        return None
    value, index = _parse_block(lines, 0, lines[0].indent)
    if index != len(lines):
        raise YamlishError("unexpected indentation", lines[index].number)
    return value


def _strip_comment(raw: str) -> str:
    quote = None
    for i, ch in enumerate(raw):
        if quote:
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
        elif ch == "#" and (i == 0 or raw[i - 1] in " \t"):
            return raw[:i]
    return raw


def _significant_lines(text: str) -> list[_Line]:
    out = []
    for number, raw in enumerate(text.splitlines(), start=1):
        if "\t" in raw[: len(raw) - len(raw.lstrip())]:
            raise YamlishError("tabs are not allowed for indentation", number)
        stripped = _strip_comment(raw).rstrip()
        if not stripped.strip():
            continue
        indent = len(stripped) - len(stripped.lstrip(" "))
        out.append(_Line(number, indent, stripped.strip()))
    return out


def _is_list_item(text: str) -> bool:
    return text == "-" or text.startswith("- ")


def _split_key(text: str, number: int) -> tuple[str, str] | None:
    """Split 'key: value' (or 'key:'). Returns None if the text isn't a mapping entry."""
    if text[:1] in "[{\"'":
        if text[0] in "\"'":
            end = text.find(text[0], 1)
            if end > 0 and text[end + 1 : end + 2] == ":" and text[end + 2 : end + 3] in ("", " "):
                return text[1:end], text[end + 2 :].strip()
        return None
    match = re.match(r"^([^:]+?):(?:\s+(.*))?$", text)
    if not match or " #" in match.group(1):
        return None
    return match.group(1).strip(), (match.group(2) or "").strip()


def _parse_block(lines: list[_Line], index: int, indent: int):
    if _is_list_item(lines[index].text):
        return _parse_list(lines, index, indent)
    return _parse_mapping(lines, index, indent)


def _parse_list(lines, index, indent):
    items = []
    while index < len(lines) and lines[index].indent == indent and _is_list_item(lines[index].text):
        line = lines[index]
        rest = line.text[1:].strip()
        index += 1
        if not rest:
            if index < len(lines) and lines[index].indent > indent:
                value, index = _parse_block(lines, index, lines[index].indent)
            else:
                value = None
        elif rest[0] not in "[{\"'" and _split_key(rest, line.number):
            # "- key: value" starts a mapping whose keys sit at the column after "- ".
            child_indent = indent + (len(line.text) - len(rest))
            value, index = _parse_mapping(lines, index, child_indent, first=_Line(line.number, child_indent, rest))
        else:
            value = parse_scalar(rest, line.number)
        items.append(value)
    return items, index


def _parse_mapping(lines, index, indent, first: _Line | None = None):
    """Parse a block mapping at `indent`. `first` is an entry already consumed from a list
    item ("- key: value"); its children, if any, start at lines[index]."""
    result: dict = {}
    if first is not None:
        index = _mapping_entry(result, first, lines, index, indent)
    while index < len(lines) and lines[index].indent == indent:
        line = lines[index]
        if _is_list_item(line.text):
            break
        index = _mapping_entry(result, line, lines, index + 1, indent)
    if index < len(lines) and lines[index].indent > indent:
        raise YamlishError("unexpected indentation", lines[index].number)
    return result, index


def _mapping_entry(result: dict, line: _Line, lines, index: int, indent: int) -> int:
    """Add one 'key: value' entry to `result`. `index` points just past `line`."""
    split = _split_key(line.text, line.number)
    if split is None:
        raise YamlishError(f"expected 'key: value', got {line.text!r}", line.number)
    key, rest = split
    if key in result:
        raise YamlishError(f"duplicate key {key!r}", line.number)
    if rest:
        result[key] = parse_scalar(rest, line.number)
    elif index < len(lines) and lines[index].indent > indent:
        result[key], index = _parse_block(lines, index, lines[index].indent)
    elif index < len(lines) and lines[index].indent == indent and _is_list_item(lines[index].text):
        result[key], index = _parse_list(lines, index, indent)
    else:
        result[key] = None
    return index


def parse_scalar(text: str, line: int | None = None):
    text = text.strip()
    if text[:1] in "[{":
        parser = _FlowParser(text, line)
        value = parser.value()
        parser.skip_space()
        if parser.pos != len(text):
            raise YamlishError(f"trailing text after flow value: {text[parser.pos :]!r}", line)
        return value
    if text[:1] in "\"'":
        parser = _FlowParser(text, line)
        value = parser.quoted()
        if parser.pos != len(text):
            raise YamlishError(f"trailing text after quoted string: {text!r}", line)
        return value
    return _plain(text)


def _plain(text: str):
    lowered = text.lower()
    if lowered in ("null", "~", ""):
        return None
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    if _INT.match(text):
        return int(text)
    if _FLOAT.match(text):
        return float(text)
    return text


class _FlowParser:
    def __init__(self, text: str, line: int | None):
        self.text = text
        self.pos = 0
        self.line = line

    def error(self, message: str):
        return YamlishError(f"{message} at column {self.pos + 1}", self.line)

    def skip_space(self):
        while self.pos < len(self.text) and self.text[self.pos] == " ":
            self.pos += 1

    def peek(self) -> str:
        return self.text[self.pos] if self.pos < len(self.text) else ""

    def value(self):
        self.skip_space()
        ch = self.peek()
        if ch == "[":
            return self.flow_list()
        if ch == "{":
            return self.flow_map()
        if ch in "\"'":
            return self.quoted()
        return _plain(self.bare(stop=",]}"))

    def bare(self, stop: str) -> str:
        start = self.pos
        while self.pos < len(self.text):
            ch = self.text[self.pos]
            if ch in stop:
                break
            if ch == ":" and ":" in stop and self.text[self.pos + 1 : self.pos + 2] in (" ", ""):
                break
            self.pos += 1
        return self.text[start : self.pos].strip()

    def quoted(self) -> str:
        quote = self.peek()
        self.pos += 1
        out = []
        while True:
            if self.pos >= len(self.text):
                raise self.error("unterminated string")
            ch = self.text[self.pos]
            if quote == "'" and ch == "'":
                if self.text[self.pos + 1 : self.pos + 2] == "'":
                    out.append("'")
                    self.pos += 2
                    continue
                self.pos += 1
                return "".join(out)
            if quote == '"' and ch == "\\":
                nxt = self.text[self.pos + 1 : self.pos + 2]
                out.append({"n": "\n", "t": "\t", '"': '"', "\\": "\\"}.get(nxt, nxt))
                self.pos += 2
                continue
            if quote == '"' and ch == '"':
                self.pos += 1
                return "".join(out)
            out.append(ch)
            self.pos += 1

    def expect(self, ch: str):
        self.skip_space()
        if self.peek() != ch:
            raise self.error(f"expected {ch!r}")
        self.pos += 1

    def flow_list(self) -> list:
        self.expect("[")
        items = []
        self.skip_space()
        if self.peek() == "]":
            self.pos += 1
            return items
        while True:
            items.append(self.value())
            self.skip_space()
            if self.peek() == ",":
                self.pos += 1
                continue
            self.expect("]")
            return items

    def flow_map(self) -> dict:
        self.expect("{")
        result: dict = {}
        self.skip_space()
        if self.peek() == "}":
            self.pos += 1
            return result
        while True:
            self.skip_space()
            key = self.quoted() if self.peek() in "\"'" else self.bare(stop=":,}")
            if not key:
                raise self.error("empty key")
            if key in result:
                raise self.error(f"duplicate key {key!r}")
            self.expect(":")
            result[key] = self.value()
            self.skip_space()
            if self.peek() == ",":
                self.pos += 1
                continue
            self.expect("}")
            return result
