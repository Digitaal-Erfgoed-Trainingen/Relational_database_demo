"""Zet het Excel-bestand om naar data.js. Gebruik: python build_data.py [bestand.xlsx]"""
import sys, json, pandas as pd
src = sys.argv[1] if len(sys.argv) > 1 else "historisch-glas-in-gebouwen_relationeel.xlsx"
x = pd.read_excel(src, sheet_name=None, dtype=object)
def rows(df):
    out = []
    for r in df.to_dict("records"):
        d = {}
        for k, v in r.items():
            if pd.isna(v): continue
            if isinstance(v, float) and v.is_integer(): v = int(v)
            d[k.strip()] = v.strip() if isinstance(v, str) else v
        out.append(d)
    return out
data = {"gebouwen": rows(x["gebouwen"]), "glasobjecten": rows(x["glasobjecten"])}
open("data.js", "w", encoding="utf-8").write("window.DATA = " + json.dumps(data, ensure_ascii=False) + ";\n")
print(len(data["gebouwen"]), "gebouwen,", len(data["glasobjecten"]), "glasobjecten")
