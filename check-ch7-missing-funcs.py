import re
import pathlib

base = pathlib.Path(__file__).parent
files = [
    "momentum_bat_ball.html",
    "billiard_momentum.html",
    "momentum_2balls_xy.html",
    "momentum_split_merge.html",
    "restitution_ground.html",
    "restitution_1D_collision.html",
]

assign_re = re.compile(r"(?<![.\w])([A-Za-z_$][\w$]*)\s*=")
decl_re = re.compile(r"\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)")
func_call_re = re.compile(r"\b([A-Za-z_$][\w$]*)\s*\(")

skip = {
    "if", "for", "while", "switch", "catch", "return", "document", "window", "Math",
    "ctx", "canvas", "layout", "phase", "statusPanel", "console", "requestAnimationFrame",
    "performance", "ResizeObserver", "setTimeout", "fmt", "add", "sub", "scale", "len",
    "dot", "vecLen", "parseFloat", "String", "Number", "Object", "Array", "JSON",
}

for f in files:
    text = base.joinpath(f).read_text(encoding="utf-8")
    script = text.split("<script>", 1)[1].split("</script>", 1)[0]
    declared = set(decl_re.findall(script))
    declared.update(re.findall(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\(", script))
    called = set(func_call_re.findall(script))
    missing_funcs = sorted(
        c for c in called
        if c not in declared and c[0].islower() and c not in skip and not c.startswith("getElement")
    )
    # crude: identifiers assigned without declaration at script top-level
    assigns = assign_re.findall(script)
    maybe_undecl = sorted(set(assigns) - declared - skip)
    bad = [m for m in missing_funcs if m not in declared]
    if bad:
        print(f"=== {f} possible missing functions ===")
        for m in bad[:20]:
            print(" ", m)
