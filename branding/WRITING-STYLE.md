# Tebako writing style

Adopted 2026-09-19 as the house style for all published tebako prose: the
website, the documentation, and the blog. The rules below are the OIML SMART
program's writing style (oimlsmart/branding/WRITING-STYLE.md), adopted in
full; the corpora named in it map to tebako as follows: the press-release
register governs release announcements and blog posts, and the technical
register governs the documentation and the site pages.

# Writing style

This document defines the professional technical writing style for all
published prose of the OIML SMART program: website pages, product interfaces,
panel and dialogue copy, documentation summaries, release notes and public
announcements. Every sentence written for a reader follows the rules in this
document. The style is observed in two corpora that the program maintains: the
press releases at `www.ribose.com` and the editorial prose of the ISO and
ISO/IEC standards the program authors (`iso-19135-2025`, `iso-8601-1-2026`).
The technical register applies to explanation and the announcement register
applies to news.

## Part I — the sentence

1. **Every sentence is a complete sentence.** Each sentence carries a subject
   and a verb and stands on its own as a statement. Fragments used as style —
   headline clips, tag lines, one-word paragraphs — are not used. This rule
   admits no exception, because a fragment omits the agent of an action and
   therefore omits responsibility for it.

2. **A sentence may be long, and length is not a fault.** Information is
   carried in subordinate clauses introduced by "which", "that", "allowing",
   "with" and "including", so that one sentence states a fact together with
   its consequence or its motivation. The following sentence, from the source
   corpus, is the model of this construction:

   > Ribose has been authorized by the Common Vulnerabilities and Exposures
   > (CVE) Program as a CVE Numbering Authority (CNA), allowing it to publish
   > authoritative cybersecurity vulnerability information of its products and
   > services into the CVE List that feeds into the U.S. National
   > Vulnerability Database (NVD).

3. **A term is written in full at first use, followed by its abbreviation in
   parentheses; the abbreviation is used thereafter.** For example,
   "Metanorma Knowledge Objects (MKO)" at first use and "MKO" from that point
   onward.

4. **Claims are grounded in named entities, dates and numbers.** A statement
   of capability states what was measured, over which corpus, against which
   standard, and with which result. Adjectives do not carry the argument;
   facts do. Unverifiable superlatives are not used.

5. **A referenced entity is introduced before it is relied upon.** When a
   paragraph depends on a body, a standard or a mechanism, the following
   sentence defines that entity before the prose returns to the point.

6. **Attributed, fully-sentenced quotations carry the human voice.** Where an
   opinion or a motivation appears, it appears inside a complete quotation
   attributed to a named role.

## Part II — the register

7. **Third person and declarative.** Announcements are reported in the
   present perfect ("has completed", "has been measured"). Explanations are
   written in the present tense. The reader is not addressed in the second
   person in descriptive prose, imperatives are reserved for instructions,
   and rhetorical questions are not used.

8. **The artifact is an admissible subject.** Scope and capability statements
   are written with the document or the system as the subject in the
   declarative: "This document specifies representations of dates of the
   Gregorian calendar and times based on the 24-hour clock", "This document
   introduces the Framework for Extensible Registration of Information
   (FERIN)", "This document excludes the representation of date elements from
   non-Gregorian calendars". The same pattern applies to a service: "The
   service evaluates the machine-checkable rule against the values in the
   question and attaches the verdict as data."

9. **The introduction establishes the problem before the solution.** An
   explanatory page first states the challenge in flowing declarative
   paragraphs, and only then introduces the mechanism that answers it. The
   reader is given the reason a thing exists before the thing is described.

10. **Formal enumerations are grammatically parallel.** A list introduced by
    "in a manner that:" continues with clauses that all share one grammatical
    structure, as in "enables persistent identification and access to its
    content; supports evolution of its content through time; retains change
    history of its content; protects the integrity of its content".

11. **Boundaries are stated explicitly in sentences.** What a thing excludes
    or does not address is written as a complete sentence and is not implied
    by omission.

12. **The vocabulary is formal and precise.** Preferred constructions include
    "in accordance with", "it is necessary to establish", "designed to meet
    the needs of" and "is applicable for". Contractions are not used in
    descriptive prose. Punctuation serves the sentence: the em dash is used
    for parenthetical ranges and definitions and never as a dramatic pause,
    and no sentence ends on an ellipsis for effect.

## Part III — what this style excludes

- Fragments written for rhythm, such as "No change ships on a single
  successful run." or "Answers the documents define but never print."
- Coined compound labels standing in place of a sentence, such as "witness
  spans" or "typed artifact legs"; a mechanism is instead described in a
  sentence that names its parts and their relation.
- Exclamations, teaser lines, and vocabulary that anticipitates a marketing
  register rather than an engineering or academic one.
- Ellipses, one-word paragraphs, and sentences whose subject is implied
  rather than stated.

## A worked example

Before (fragments, coined labels, no agent):

> Witness spans. Each probe declares anchor + witness. Containment is
> mechanical. No partial credit. Typed-artifact legs assert block type —
> retyped prose doesn't pass.

After (house style):

> Each probe declares the citation it must return and a witness, which is a
> span of text that must appear character for character inside one of the
> retrieved passages. A script checks this containment mechanically, no judge
> participates in the check, and no partial credit is awarded. Probes that
> ask for a table, a formula or a figure require the answer to carry the
> object itself, and an answer that retypes the contents of the object as
> prose does not pass, because the structure of the object is part of the
> answer.
