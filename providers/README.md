# The facts

One file per provider **and per layer**, filed in its layer's directory:

```
providers/
  model/anthropic.yaml
  model/openai.yaml
  transcription/deepgram.yaml
  storage/aws-s3.yaml
```

The layers are `model`, `transcription`, `tts`, `telephony`, `storage` and
`platform` — the five possible links of a processing chain, plus text-to-speech.
One provider often occupies several layers: it then has one file per layer, and
the layer declared inside the file must match its directory.

The unit is the provider and the layer, never the model. A BAA, a data
processing agreement, a retention policy and a residency guarantee are
commitments made by the entity that signs them. Where a fact genuinely depends
on the model, it belongs in that provider's note and in its `models` field — not
in a row of its own. `METHODOLOGY.md` explains why.

Every fact carries its value, the date it was verified, the URL of the provider
document that states it, and the confidence level of that source. Without those
four elements the file does not validate — run `pnpm registry:check`, it names
the offending file and field.

Sources must be `http` or `https` and must lead to a document a third party can
go and read. A third-party blog post is not a source; nor is a competitor's
documentation. And the source must state the fact in its main text — not behind
an accordion, a tab or a second link.
