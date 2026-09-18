"""Minimal multi-sheet .xlsx writer, Python standard library only.

Neither openpyxl nor pandas can be installed in the sandbox this project is
developed in - pypi is unreachable - so the sweep tools write their workbooks
through this instead.

    from xlsxwrite import Workbook
    wb = Workbook()
    wb.sheet("Breakpoints",
             ["team", "world", "bp"],            # header row
             [["Ash, Maul", "murk", 4.43], ...],  # data rows
             widths=[34, 10, 8],                  # optional, characters
             formats=[None, None, "2dp"])         # optional, per column
    wb.save("out.xlsx")

Cell values: str, int, float, None, or a string beginning with "=" which is
written as a formula. Formulas carry no cached value, so a reader that only
looks at cached values sees them as empty until the file is opened in a
spreadsheet application, which recalculates on load.

Every sheet gets a frozen header row and an autofilter, because these
workbooks exist to be sorted and filtered.
"""

import zipfile
from xml.sax.saxutils import escape

# cellXfs indices, referenced by the `formats` argument to sheet()
_FMT = {None: 0, "text": 0, "header": 1, "2dp": 2, "1dp": 3, "int": 4, "pct": 5}

_CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    "{overrides}</Types>"
)

_ROOT_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    "</Relationships>"
)

# Arial throughout, per the house style for these deliverables.
_STYLES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="0.0%"/>'
    '<numFmt numFmtId="165" formatCode="0.0"/></numFmts>'
    '<fonts count="2">'
    '<font><sz val="11"/><name val="Arial"/></font>'
    '<font><b/><sz val="11"/><name val="Arial"/></font>'
    "</fonts>"
    '<fills count="3">'
    '<fill><patternFill patternType="none"/></fill>'
    '<fill><patternFill patternType="gray125"/></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEFEFEF"/><bgColor indexed="64"/></patternFill></fill>'
    "</fills>"
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    '<cellXfs count="6">'
    '<xf numFmtId="0"   fontId="0" fillId="0" borderId="0" xfId="0"/>'
    '<xf numFmtId="0"   fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
    '<xf numFmtId="2"   fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    '<xf numFmtId="1"   fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    "</cellXfs>"
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    "</styleSheet>"
)


def _col(i):
    """0 -> A, 25 -> Z, 26 -> AA."""
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def _cell(ref, value, style):
    if value is None or value == "":
        return ""
    st = f' s="{style}"' if style else ""
    if isinstance(value, bool):
        value = str(value)
    if isinstance(value, (int, float)):
        return f'<c r="{ref}"{st}><v>{value}</v></c>'
    text = str(value)
    if text.startswith("="):
        return f'<c r="{ref}"{st}><f>{escape(text[1:])}</f></c>'
    return f'<c r="{ref}"{st} t="inlineStr"><is><t xml:space="preserve">{escape(text)}</t></is></c>'


class Workbook:
    def __init__(self):
        self._sheets = []

    def sheet(self, name, header, rows, widths=None, formats=None, freeze=True, autofilter=True):
        """Add a sheet. `name` is truncated to Excel's 31-character limit."""
        self._sheets.append(
            dict(
                name=str(name)[:31],
                header=list(header),
                rows=[list(r) for r in rows],
                widths=widths,
                formats=formats,
                freeze=freeze,
                autofilter=autofilter,
            )
        )
        return self

    def _sheet_xml(self, s):
        ncols = max([len(s["header"])] + [len(r) for r in s["rows"]] or [0])
        styles = [_FMT.get(f, 0) for f in (s["formats"] or [None] * ncols)]
        styles += [0] * (ncols - len(styles))

        cols = ""
        if s["widths"]:
            body = "".join(
                f'<col min="{i+1}" max="{i+1}" width="{w}" customWidth="1"/>'
                for i, w in enumerate(s["widths"])
            )
            cols = f"<cols>{body}</cols>"

        out = ["<sheetData>"]
        out.append(
            '<row r="1">'
            + "".join(_cell(f"{_col(i)}1", v, 1) for i, v in enumerate(s["header"]))
            + "</row>"
        )
        for n, row in enumerate(s["rows"], start=2):
            cells = "".join(_cell(f"{_col(i)}{n}", v, styles[i]) for i, v in enumerate(row))
            out.append(f'<row r="{n}">{cells}</row>')
        out.append("</sheetData>")

        pane = (
            '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" '
            'activePane="bottomLeft" state="frozen"/></sheetView>'
            if s["freeze"]
            else '<sheetView workbookViewId="0"/>'
        )
        last = f"{_col(max(0, ncols - 1))}{len(s['rows']) + 1}"
        af = f'<autoFilter ref="A1:{last}"/>' if s["autofilter"] and s["rows"] else ""

        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f"<sheetViews>{pane}</sheetViews>{cols}{''.join(out)}{af}</worksheet>"
        )

    def save(self, path):
        n = len(self._sheets)
        overrides = "".join(
            f'<Override PartName="/xl/worksheets/sheet{i}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            for i in range(1, n + 1)
        )
        tabs = "".join(
            f'<sheet name="{escape(s["name"])}" sheetId="{i}" r:id="rId{i}"/>'
            for i, s in enumerate(self._sheets, start=1)
        )
        workbook = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f"<sheets>{tabs}</sheets></workbook>"
        )
        rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + "".join(
                f'<Relationship Id="rId{i}" '
                'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
                f'Target="worksheets/sheet{i}.xml"/>'
                for i in range(1, n + 1)
            )
            + f'<Relationship Id="rId{n+1}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
            'Target="styles.xml"/></Relationships>'
        )

        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("[Content_Types].xml", _CONTENT_TYPES.format(overrides=overrides))
            z.writestr("_rels/.rels", _ROOT_RELS)
            z.writestr("xl/workbook.xml", workbook)
            z.writestr("xl/_rels/workbook.xml.rels", rels)
            z.writestr("xl/styles.xml", _STYLES)
            for i, s in enumerate(self._sheets, start=1):
                z.writestr(f"xl/worksheets/sheet{i}.xml", self._sheet_xml(s))
        return path
