S="${1:?scratch folder with m1raw/ and fab_clean.scr}"
OUT="$S/m1final"; mkdir -p "$OUT"; rm -f "$OUT"/*
for f in "$S"/m1raw/*.dwg; do
  b=$(basename "$f"); cp "$f" "$OUT/$b"
  MSYS_NO_PATHCONV=1 timeout 240 "/c/Program Files/Autodesk/AutoCAD 2026/accoreconsole.exe" /i "$(cygpath -w "$OUT/$b")" /s "$(cygpath -w "$(dirname "$0")/fab_clean.scr")" /l en-US > "$OUT/${b%.dwg}.log" 2>&1
  r=$(tr -d '\0' < "$OUT/${b%.dwg}.log" | grep -E "REMOVED3D|converted|Alert" | grep -v strcat | tr '\n' ' ')
  echo "$b :: $r"
done
rm -f "$OUT"/*recover* 
