import { ActionIcon, Anchor, Button, Card, Group, Select, Stack, Text, Title, Tooltip } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconFileText, IconTrash } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";

import type { ApplicationDetail } from "../api/client";
import { KIND_LABEL, useDocuments, useSendDocument, useUnsendDocument } from "../api/documentHooks";
import { formatDate } from "../utils/time";

/** Which CV and cover-letter versions went with this application, and when. */
export function SentDocumentsCard({ app }: { app: ApplicationDetail }) {
  const { data: documents } = useDocuments();
  const send = useSendDocument(app.id);
  const unsend = useUnsendDocument(app.id);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [sentOn, setSentOn] = useState<string | null>(dayjs().format("YYYY-MM-DD"));

  const already = new Set(app.documents.map((d) => d.version_id));
  const options = (documents ?? [])
    .map((doc) => ({
      group: `${doc.name} (${KIND_LABEL[doc.kind] ?? doc.kind})`,
      items: doc.versions
        .filter((v) => !already.has(v.id))
        .map((v) => ({ value: v.id, label: `${doc.name} · ${v.label}` })),
    }))
    .filter((g) => g.items.length);

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>Documents sent</Title>
        {app.documents.map((d) => (
          <Group key={d.id} justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
              <IconFileText size={18} stroke={1.6} />
              <div style={{ minWidth: 0 }}>
                <Group gap={6} wrap="nowrap">
                  <Anchor component={Link} to="/documents" size="sm" fw={500}>
                    {d.document_name}
                  </Anchor>
                  <Text size="sm">{d.version_label}</Text>
                  {d.file_url && (
                    <Anchor href={d.file_url} target="_blank" rel="noreferrer noopener" size="xs">
                      open
                    </Anchor>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {KIND_LABEL[d.kind] ?? d.kind}
                  {d.sent_on ? ` · sent ${formatDate(d.sent_on)}` : ""}
                </Text>
              </div>
            </Group>
            <Tooltip label="Not sent with this one">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => unsend.mutate(d.id)}
                aria-label={`Remove ${d.document_name} ${d.version_label}`}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ))}
        {!app.documents.length && (
          <Text size="sm" c="dimmed">
            Record which CV and cover letter you sent, so you know what they've seen.
          </Text>
        )}
        {documents && !documents.some((d) => d.versions.length) ? (
          <Text size="sm" c="dimmed">
            <Anchor component={Link} to="/documents" size="sm">
              Add your CV on the Documents page
            </Anchor>{" "}
            first.
          </Text>
        ) : (
          <Group align="flex-end" gap="xs" wrap="nowrap">
            <Select
              size="xs"
              label="Version"
              placeholder="Pick a CV or cover letter"
              data={options}
              value={versionId}
              onChange={setVersionId}
              searchable
              style={{ flex: 2 }}
            />
            <DateInput
              size="xs"
              label="Sent on"
              clearable
              value={sentOn}
              onChange={setSentOn}
              style={{ flex: 1 }}
            />
            <Button
              size="xs"
              variant="light"
              disabled={!versionId}
              loading={send.isPending}
              onClick={() =>
                versionId &&
                send.mutate(
                  {
                    document_version_id: versionId,
                    sent_on: sentOn ? dayjs(sentOn).format("YYYY-MM-DD") : null,
                  },
                  { onSuccess: () => setVersionId(null) },
                )
              }
            >
              Add
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
