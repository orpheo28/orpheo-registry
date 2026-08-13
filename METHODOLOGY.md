# Methodology

How a fact enters this registry, how often it is re-checked, and what we do not
verify.

> This file is GENERATED from `site/methodology.ts`, which is also the source of
> the public page. Do not edit it by hand: CI checks that the two match, so the
> repository version and the published version cannot drift apart.

## What this registry claims — and what it does not

This registry never says a provider is compliant. Compliance depends on your use, your jurisdiction and your contract — not on the provider alone, and certainly not on us.

It says one thing, precisely: on this date, this document from this provider stated this, and here is where to read it. What you conclude is yours.

Every fact therefore carries three inseparable elements: its value, the date it was verified, and the URL of the document that states it. A fact missing any of the three is not published — that is not an editorial guideline, it is the validator refusing the file.

## The unit of this registry is the provider and the layer

One entry per provider and per layer — model, transcription, text-to-speech, telephony, storage, platform. Not one entry per model.

This is deliberate. A BAA, a data processing agreement, a retention policy and a residency guarantee are commitments made by the ENTITY THAT SIGNS. They are facts about the provider, not about the model: the same provider offers the same agreement whichever of its models you call.

Indexing model by model would multiply rows without adding a single fact, and would suggest that the answer changes with the model — which is exactly the confusion a buyer needs removed.

Where a fact genuinely does depend on the model, it is recorded in the provider's note and in the `models` field, not in a separate row. Two such cases are already indexed: a HIPAA eligibility that excludes two named models, and a retention regime that applies to a specific class of models and is incompatible with zero retention. Both are exceptions written inside the provider's entry — which is where a reader will look for them.

The same rule explains why an open-weight model distributor is absent entirely: it operates no inference service, holds no data, and signs no agreement about either. The question does not arise at its level — it arises for whoever hosts the model, and that host is indexed on the layer it occupies.

## Where the facts come from

From a document published by the provider itself: commercial terms, data processing addendum, privacy centre, technical documentation. Never a third-party blog post, never a competitor's comparison, never a machine-generated summary.

A source must state the fact IN ITS MAIN TEXT — not behind an accordion, a tab, a modal or a second link to follow. A page that contains the answer but only reveals it after a gesture is not re-verifiable by a third party: whoever opens the address must read the fact there, or they can neither confirm nor challenge it.

This rule comes from a real mistake. A fact had been attached to a page that did carry it — inside a collapsed question. The address responded, the fact was true, and yet the source proved nothing to anyone who opened it. It was replaced by the page that states it directly.

The confidence level qualifies THE NATURE OF THE SOURCE, never our degree of conviction. « I think this is true » is not a confidence level: it is an opinion, and this registry does not publish opinions.

- high — the provider's own contractual document
- medium — public, non-contractual documentation
- low — a support answer, not published

The top level carries an extra obligation: a fact marked high must record the exact sentence from the document, and the validator refuses it otherwise. Without a quote the ceiling is medium.

The reason is that high is the strongest claim this registry makes — that a contractual document states the fact — and it was the least replayable. A reader who could not see the sentence had to reopen the document and trust the judgement of whoever read it first. That is exactly what this registry holds against comparison tables.

This rule was written after finding six of sixteen high facts resting on a reading with no sentence kept. Five of those could not be repaired: two of the pages now refuse automated readers, so the sentence could no longer be recovered at all. Those facts were not deleted — they dropped to medium, keeping their date and their source. What you cannot prove, you rank lower; you do not hide it.

It also has a use nobody planned: recording the sentence caught a fact whose note claimed more than its source said. The quote and the claim did not match, and the claim was the one that was wrong.

A quote must be in the LANGUAGE OF THE URL published beside it. This is the main-text rule applied to language, and for the same reason: a reader who opens the address has to find the sentence there. A translated quote fails that test exactly as a sentence hidden behind an accordion does — the fact may well be true, and the source still proves nothing to the person checking it.

This one also comes from a real case, caught before publication. Two facts about one provider had been re-read by a human on pages that refuse automated readers — genuine verification, carefully done. But the pages had been opened in French, and the registry publishes the English addresses. Recording the French sentences would have sent an American reader to a page where they do not appear; back-translating them into English would have manufactured the very evidence the quote exists to supply. Neither was recorded. The facts kept their date and their source, and stayed at medium until the English sentences can be read.

The rule cuts against convenience, and that is the point: a quote is not an illustration of a fact, it is the means of contesting it.

## Three states, and the difference matters

A fact can carry a value, be recorded as verifiably absent, or be missing. Collapsing the last two would make the matrix lie.

- A value — the provider states this, at this date, in this document.
- No guarantee — the provider states that it does NOT commit. This is an answer, dated and sourced, and often the one a buyer most needs.
- Not recorded — no first-party source establishes anything. This is an unknown, not a negative answer.

One provider writes that customer data « may be stored and processed in a location outside of the European Economic Area ». Filing that with the unknowns would have silenced something the provider took the trouble to say.

## Conditions are part of the fact

Most facts here are not booleans. A coverage can be cancelled by a setting the customer enables. A residency guarantee can cover two steps of a three-step pipeline. A default can apply when nothing is configured.

The matrix marks such facts as conditional and links to the provider's page, where the condition is written out in full with the provider's own wording. A comparison table that prints « yes » where the provider writes « yes, unless » is worse than no table at all.

## On an aggregation layer, « yes » means « yes on my side »

A router or a gateway sits above the provider that actually sees your prompt. Its policy is a real policy — and it is not the one your data experiences. What you actually get is the combination of its policy and that of the provider selected underneath.

So the registry marks two kinds of reservation, and they are not interchangeable:

- Conditional — the fact holds, and something can undo it. A setting you enable, a plan you are not on, a mode you did not configure. It is within your reach: you can read the condition and satisfy it.
- Chain-dependent — the fact holds for this provider and stops there. Nothing you do at this layer extends it downward, because this provider does not govern the layer below.

The difference is what you can do about it. A condition is lifted by configuring something. A chain dependency is not lifted at all — it propagates. Reading the second as the first is how a buyer concludes they are covered when only the top of their stack is.

OpenRouter is the case that forced this distinction, and it states both halves itself. On its privacy page: « OpenRouter does not use your Inputs or Outputs for model training. » On the same page: « We do not control, and are not responsible for, LLMs' handling of your Inputs or Outputs, including for use in their model training », and « Some Model Providers may use your Inputs and Outputs for model training or improvement. » Both sentences are true. Only the first fits in a column.

Its documentation closes the loop: « OpenRouter does not have routing rules that change based on data retention policies of providers. » Provider policies are displayed, and excluding the ones that do not suit you is your job, not the router's. So enabling zero retention at the routing layer does not enable it below, and nothing at the routing layer will tell you when it is off down there. The effective guarantee is the union of both policies, never the better of the two.

This is also why the registry indexes layers separately rather than scoring a stack. A chain is only as covered as its least covered link, and no single row can carry that.

## Which facts a human has re-read

Almost every fact here was written by reading a page fetched automatically. That method works, and it has produced errors in both directions on the same day: a source attached to a page that carried the fact only behind a collapsed question, and a mention judged absent from a page where it was in fact present.

Neither error is detectable by the automated check, which confirms that an address still answers and cannot read what it returns. So the two are recorded separately: the date a fact was established, and the date a human reopened the source and read it again.

Facts never re-read by a human are shown as such. They are not marked wrong — most of them are right. They are marked unconfirmed, because a registry that displayed re-read facts and never-re-read facts identically would be lying by uniformity.

## How often

Monthly review per provider, and immediately on a major announcement. Between reviews, an automated weekly check confirms that every source still responds.

A source that disappears or redirects elsewhere drops its fact to UNVERIFIED, with its last known date. The fact is not removed: removing it quietly would erase the fact that we no longer know.

A redirect is not always an error — sites move. But no machine can judge whether the destination still carries the fact: that check is human, and until it happens the registry displays that it no longer knows.

## Two checks, because they catch different failures

The automated check and the human review are not redundant. Neither is sufficient.

The machine verifies that a source STILL RESPONDS and has not moved. It cannot read: a page can respond perfectly and prove nothing.

The human verifies that it STILL STATES the fact, in context. Two real cases, on the same day, show why both are needed:

- A true fact attached to a page that carried it — behind a collapsed question. The address responded: the automated check would have validated it indefinitely. Only a human reading saw that the source proved nothing.
- Conversely, a human reading concluded that a mention was not on a page — a model exclusion, annotated in brackets inside an alphabetical list of several hundred services. It was there. Removing that fact would have deleted an exact exclusion, which is precisely the information that protects the reader.

Hence the tie-breaker: when a check and a reading contradict each other, neither one's memory nor the other's impression settles it. Fetch the document again and search for the exact string. The document decides, never the person who read it.

## What we do not verify

We read what the provider publishes. We do not verify that it applies it: that would require an audit, which we do not perform and do not claim to.

We do not follow our subprocessors' subprocessors beyond what the documents publish.

A fact absent from this registry does not mean it is false. It means we have not verified it.

## Independence

No position is for sale. No provider pays to appear, to rank higher, or to make a fact disappear. This registry is published free of charge and its history — public git history — is the record.

We sell a product to some of the companies described here. That is exactly why this page exists and why the history is public: an index that rates the companies it sells to must be verifiable by its readers, not taken on trust.

## Correcting a fact

If a fact is wrong or out of date, open a pull request on the registry repository with the document that establishes it. Corrections from providers themselves are welcome and treated like any other: with their source.

The history of these corrections is public. That is what lets a reader see not only what the registry states today, but what it stated, and when it changed.
