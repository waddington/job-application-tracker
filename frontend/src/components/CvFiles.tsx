import {
  Anchor,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconFileCv } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { useAdoptCvFile, useCvFiles, useDocuments, type CvFile } from "../api/documentHooks";
import { humanSize } from "./Attachments";

const NOT_A_CV = "jat.notACv";

function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOT_A_CV) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

const stem = (name: string) => name.replace(/\.[^.]+$/, "").slice(0, 100);

/** Make a file a version: of an existing document, or a new one. */
const HREF = { application: "/applications", role: "/roles", contact: "/people" } as const;

/** Make a file a version (of an existing CV or a new one), or record the version it already is,
 * on the applications you tick. */
function AdoptModal({ file, onClose }: { file: CvFile; onClose: () => void }) {
  const { t } = useTranslation(["documents", "common"]);
  const { data: documents } = useDocuments();
  const adopt = useAdoptCvFile();
  const cvs = (documents ?? []).filter((d) => d.kind === "cv");
  const [picked, setDocumentId] = useState<string | null>(null);
  // Your first CV once they've loaded, unless you've picked one.
  const documentId = picked ?? cvs[0]?.id ?? "new";
  const [name, setName] = useState<string>(() => t("adopt.defaultName"));
  const [label, setLabel] = useState(stem(file.name));
  const missing = file.applications.filter((a) => !a.has_it);
  const [ticked, setTicked] = useState<string[]>(missing.map((a) => a.id));
  const isNew = documentId === "new";
  const recordOnly = file.version !== null;
  const ready = recordOnly ? ticked.length > 0 : label.trim() && (!isNew || name.trim());
  const save = () =>
    adopt.mutate(
      recordOnly
        ? { sha256: file.sha256, kind: "cv", application_ids: ticked }
        : isNew
          ? {
              sha256: file.sha256,
              document_name: name.trim(),
              kind: "cv",
              label: label.trim(),
              application_ids: ticked,
            }
          : {
              sha256: file.sha256,
              document_id: documentId,
              kind: "cv",
              label: label.trim(),
              application_ids: ticked,
            },
      {
        onSuccess: (r) => {
          notifications.show({
            message: recordOnly
              ? t("adopt.recorded", { count: r.recorded })
              : t("adopt.made", { count: r.recorded, label: label.trim() }),
          });
          onClose();
        },
      },
    );
  return (
    <Modal
      opened
      onClose={onClose}
      title={
        recordOnly
          ? t("adopt.recordTitle", {
              document: file.version!.document_name,
              version: file.version!.label,
            })
          : t("adopt.makeTitle", { name: file.name })
      }
    >
      <Stack>
        {!recordOnly && (
          <>
            <Select
              label={t("adopt.addTo")}
              data={[
                ...cvs.map((d) => ({ value: d.id, label: d.name })),
                { value: "new", label: t("adopt.newCv") },
              ]}
              value={documentId}
              onChange={setDocumentId}
              allowDeselect={false}
            />
            {isNew && (
              <TextInput
                label={t("adopt.newName")}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
            )}
            <TextInput
              label={t("adopt.version")}
              description={t("adopt.versionHint")}
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
            />
          </>
        )}
        {missing.length ? (
          <Checkbox.Group
            label={t("adopt.sentWith")}
            description={t("adopt.sentWithHint")}
            value={ticked}
            onChange={setTicked}
          >
            <Stack gap={6} mt={6}>
              {missing.map((a) => (
                <Checkbox
                  key={a.id}
                  value={a.id}
                  label={t("adopt.application", { company: a.company_name, role: a.role_title })}
                />
              ))}
            </Stack>
          </Checkbox.Group>
        ) : (
          <Text size="sm" c="dimmed">
            {t("adopt.noneMissing")}
          </Text>
        )}
        <Text size="xs" c="dimmed">
          {t("adopt.stays")}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={save} disabled={!ready} loading={adopt.isPending}>
            {recordOnly ? t("cvFiles.recordAsSent") : t("cvFiles.makeVersion")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function CvFileRow({ file, onDismiss }: { file: CvFile; onDismiss: () => void }) {
  const { t } = useTranslation("documents");
  const [adopting, setAdopting] = useState(false);
  const missing = file.applications.filter((a) => !a.has_it);
  // Applications it's attached to are already in the list of where it counts.
  const elsewhere = file.sources.filter((x) => x.kind !== "application");
  return (
    <Group justify="space-between" wrap="wrap" gap="xs" align="flex-start">
      <div style={{ minWidth: 0, flex: 1 }}>
        <Text size="sm" fw={600}>
          {file.name}{" "}
          <Text span size="xs" c="dimmed" fw={400}>
            {humanSize(file.size)}
          </Text>
        </Text>
        {file.version && (
          <Text size="xs" c="dimmed">
            {t("cvFiles.thisIs", { document: file.version.document_name, version: file.version.label })}
          </Text>
        )}
        {elsewhere.length > 0 && (
          <Text size="xs" c="dimmed">
            {elsewhere.map((x, i) => {
              const where = (
                <Anchor component={Link} to={`${HREF[x.kind]}/${x.id}`} size="xs">
                  {x.name}
                </Anchor>
              );
              return (
                <span key={`${x.kind}:${x.id}`}>
                  {i ? " · " : ""}
                  {x.kind === "role" ? (
                    <Trans t={t} i18nKey="cvFiles.onRole" components={{ where }} />
                  ) : x.kind === "contact" ? (
                    <Trans t={t} i18nKey="cvFiles.sentTo" components={{ where }} />
                  ) : (
                    where
                  )}
                </span>
              );
            })}
          </Text>
        )}
        <Text size="xs" c="dimmed">
          {!missing.length
            ? t("cvFiles.noApplications")
            : file.version
              ? t("cvFiles.notRecordedOn", { count: missing.length })
              : t("cvFiles.for", { count: missing.length })}
          {missing.map((a, i) => (
            <span key={a.id}>
              {i ? ", " : ""}
              <Anchor component={Link} to={`/applications/${a.id}`} size="xs">
                {t("cvFiles.application", { company: a.company_name, role: a.role_title })}
              </Anchor>
            </span>
          ))}
        </Text>
      </div>
      <Group gap="xs">
        <Button size="compact-sm" variant="light" onClick={() => setAdopting(true)}>
          {file.version ? t("cvFiles.recordAsSent") : t("cvFiles.makeVersion")}
        </Button>
        <Button
          size="compact-sm"
          variant="subtle"
          color="gray"
          onClick={onDismiss}
          aria-label={t("cvFiles.notCvNamed", { name: file.name })}
        >
          {t("cvFiles.notCv")}
        </Button>
      </Group>
      {adopting && <AdoptModal file={file} onClose={() => setAdopting(false)} />}
    </Group>
  );
}

/** The CV files you've attached that aren't recorded as versions yet; nothing when there are none. */
export function CvFilesCard() {
  const { t } = useTranslation("documents");
  const { data: files } = useCvFiles();
  const [dismissed, setDismissed] = useState(readDismissed);
  const shown = (files ?? []).filter((f) => !dismissed.has(f.sha256));
  const hidden = (files ?? []).length - shown.length;
  if (!shown.length && !hidden) return null;
  const remember = (next: Set<string>) => {
    setDismissed(next);
    try {
      localStorage.setItem(NOT_A_CV, JSON.stringify([...next]));
    } catch {
      // No storage (a private window): only until the page reloads.
    }
  };
  const dismiss = (sha: string) => remember(new Set(dismissed).add(sha));
  // Forget the ones that aren't waiting any more, then show the rest again.
  const showHidden = () => remember(new Set());
  return (
    <Card withBorder>
      <Group gap="xs" mb={4}>
        <IconFileCv size={18} />
        <Title order={4}>{t("cvFiles.title")}</Title>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        {t("cvFiles.intro")}
      </Text>
      <Stack gap="sm">
        {shown.map((f) => (
          <CvFileRow key={f.sha256} file={f} onDismiss={() => dismiss(f.sha256)} />
        ))}
        {hidden > 0 && (
          <Anchor component="button" type="button" size="xs" c="dimmed" ta="left" onClick={showHidden}>
            {t("cvFiles.showHidden", { count: hidden })}
          </Anchor>
        )}
      </Stack>
    </Card>
  );
}

/** How many CV files are waiting to be made versions (for a nudge elsewhere). */
export function useCvFilesToSort() {
  const { data: files } = useCvFiles();
  const dismissed = readDismissed();
  return (files ?? []).filter((f) => f.version === null && !dismissed.has(f.sha256)).length;
}
