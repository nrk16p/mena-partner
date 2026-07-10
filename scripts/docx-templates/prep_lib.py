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


def strip_numbering(xml_path):
    """ลบ <w:numPr> ทั้งหมด — เอกสารสัญญาใช้เลขเป็น text (ข้อ 1., 3.1) อยู่แล้ว
    numPr ที่ค้างทำให้ docx-preview/บาง renderer โชว์เลข auto (เช่น 0.1, 0.2) เกินมา"""
    tree = etree.parse(xml_path)
    root = tree.getroot()
    removed = 0
    for numPr in root.iter(W + "numPr"):
        parent = numPr.getparent()
        if parent is not None:
            parent.remove(numPr)
            removed += 1
    if removed:
        tree.write(xml_path, xml_declaration=True, encoding="UTF-8", standalone=True)
    return removed


MC = "{http://schemas.openxmlformats.org/markup-compatibility/2006}"


def strip_images(xml_path):
    """ลบรูปที่ฝังในไฟล์ออกทั้งหมด (โลโก้/ลายเซ็น/รูป): <w:drawing>, <w:pict>, <w:object>,
    และ <mc:AlternateContent> (textbox/รูปแบบเก่า). เก็บไฟล์ media ไว้เฉยๆ (rels ที่ค้างไม่เป็นไร)"""
    tree = etree.parse(xml_path)
    root = tree.getroot()
    removed = 0
    for tag in (W + "drawing", W + "pict", W + "object", MC + "AlternateContent"):
        for el in list(root.iter(tag)):
            parent = el.getparent()
            if parent is not None:
                parent.remove(el)
                removed += 1
    if removed:
        tree.write(xml_path, xml_declaration=True, encoding="UTF-8", standalone=True)
    return removed


REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"
IMG_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"


def strip_media(workdir):
    """ลบไฟล์รูปใน word/media/* + relationship ชนิด image ใน *.rels (ให้ไฟล์เล็กลง/ไม่ค้าง)
    คืน set ของ path (relative to workdir) ที่ถูกลบ"""
    dropped = set()
    mediadir = os.path.join(workdir, "word", "media")
    if os.path.isdir(mediadir):
        for f in os.listdir(mediadir):
            dropped.add(os.path.join("word", "media", f))
    relsdir = os.path.join(workdir, "word", "_rels")
    if os.path.isdir(relsdir):
        for rf in os.listdir(relsdir):
            if not rf.endswith(".rels"):
                continue
            rp = os.path.join(relsdir, rf)
            tree = etree.parse(rp)
            root = tree.getroot()
            changed = False
            for rel in list(root):
                if rel.get("Type") == IMG_REL:
                    root.remove(rel)
                    changed = True
            if changed:
                tree.write(rp, xml_declaration=True, encoding="UTF-8", standalone=True)
    return dropped


def build_template(src_docx, out_docx, doc_rules, footer_rules=None, workdir=None,
                   drop_numbering=True, drop_images=True):
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

    if drop_numbering:
        strip_numbering(dpath)

    # ลบรูปใน document + header + footer ทั้งหมด
    dropped_files = set()
    if drop_images:
        strip_images(dpath)
        worddir = os.path.join(workdir, "word")
        for fname in sorted(os.listdir(worddir)):
            if (fname.startswith("header") or fname.startswith("footer")) and fname.endswith(".xml"):
                strip_images(os.path.join(worddir, fname))
        dropped_files = strip_media(workdir)

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
            if name.replace("\\", "/") in {d.replace("\\", "/") for d in dropped_files}:
                continue  # ข้ามไฟล์รูปที่ลบไปแล้ว
            z.write(os.path.join(workdir, name), name)

    shutil.rmtree(workdir)
    return total_matched, all_unmatched
