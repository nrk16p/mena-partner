"""Shared helpers to turn an original .docx into a docxtemplater template.

Strategy: match a *specimen phrase* in the concatenated text of a paragraph and
replace it with a phrase containing {placeholders}. This is robust against Word
splitting text across many runs (run-splitting), because we rewrite the underlying
<w:t> runs so their concatenation becomes prefix+replacement+suffix, with the
replacement text landing in the run that held the match start (its formatting).

Rules operate per-paragraph, scoped by an `anchor` substring so ambiguous values
(lone digits, repeated tokens) only match in the intended paragraph.
"""
import re
import shutil
import zipfile
import os
from lxml import etree

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"


def _texts(p):
    return list(p.iter(W + "t"))


def _concat(ts):
    return "".join(t.text or "" for t in ts)


def _apply_span(ts, idx, length, repl):
    """Rewrite run texts so concat becomes prefix + repl + suffix over [idx, idx+length)."""
    pos = 0
    inserted = False
    new_vals = []
    for t in ts:
        txt = t.text or ""
        s, e = pos, pos + len(txt)
        pos = e
        if not inserted and s <= idx < e:
            prefix = "".join(ch for gi, ch in zip(range(s, e), txt) if gi < idx)
            suffix = "".join(ch for gi, ch in zip(range(s, e), txt) if gi >= idx + length)
            new_vals.append(prefix + repl + suffix)
            inserted = True
        else:
            keep = "".join(ch for gi, ch in zip(range(s, e), txt) if gi < idx or gi >= idx + length)
            new_vals.append(keep)
    for t, v in zip(ts, new_vals):
        t.text = v
        t.set(XML_SPACE, "preserve")
    return inserted


def apply_rules(xml_path, rules):
    """rules: list of dicts:
       {anchor, find, repl}            literal find within first paragraph containing anchor
       {anchor, re, repl}              regex find (repl may use \\1 groups)
       {anchor, find, repl, all:True}  replace in every paragraph containing anchor
    Returns (matched_count, unmatched_rules)."""
    tree = etree.parse(xml_path)
    root = tree.getroot()
    paras = [p for p in root.iter(W + "p")]
    matched = 0
    unmatched = []
    for rule in rules:
        anchor = rule["anchor"]
        want_all = rule.get("all", False)
        hit_any = False
        for p in paras:
            ts = _texts(p)
            concat = _concat(ts)
            if anchor not in concat:
                continue
            if "re" in rule:
                m = re.search(rule["re"], concat)
                if not m:
                    continue
                repl = m.expand(rule["repl"])
                ok = _apply_span(ts, m.start(), m.end() - m.start(), repl)
            else:
                idx = concat.find(rule["find"])
                if idx < 0:
                    continue
                ok = _apply_span(ts, idx, len(rule["find"]), rule["repl"])
            if ok:
                matched += 1
                hit_any = True
                if not want_all:
                    break
        if not hit_any:
            unmatched.append(rule)
    tree.write(xml_path, xml_declaration=True, encoding="UTF-8", standalone=True)
    return matched, unmatched


def build_template(src_docx, out_docx, doc_rules, footer_rules=None, workdir=None):
    """Unzip src, apply rules to document.xml (+ footers), rezip to out_docx."""
    workdir = workdir or (out_docx + ".unz")
    if os.path.exists(workdir):
        shutil.rmtree(workdir)
    os.makedirs(workdir)
    with zipfile.ZipFile(src_docx) as z:
        names = z.namelist()
        z.extractall(workdir)

    total_matched = 0
    all_unmatched = []

    dpath = os.path.join(workdir, "word", "document.xml")
    m, un = apply_rules(dpath, doc_rules)
    total_matched += m
    all_unmatched += un

    if footer_rules:
        for fname in sorted(os.listdir(os.path.join(workdir, "word"))):
            if fname.startswith("footer") and fname.endswith(".xml"):
                fp = os.path.join(workdir, "word", fname)
                m, un = apply_rules(fp, footer_rules)
                total_matched += m
                # footers: only warn if NONE of the footers matched (handled by caller)

    # rezip preserving original entry order
    if os.path.exists(out_docx):
        os.remove(out_docx)
    with zipfile.ZipFile(out_docx, "w", zipfile.ZIP_DEFLATED) as z:
        for name in names:
            z.write(os.path.join(workdir, name), name)

    shutil.rmtree(workdir)
    return total_matched, all_unmatched
