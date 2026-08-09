import re
import pathlib
import html.parser

class IdCollector(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k == "id":
                self.ids.add(v)


def js_ids(text):
    return set(re.findall(r'getElementById\("([^"]+)"\)', text))


def query_ids(text):
    return set(re.findall(r'querySelector\("([^"]+)"\)', text))


base = pathlib.Path(__file__).parent
files = [
    "momentum_bat_ball.html",
    "billiard_momentum.html",
    "momentum_2balls_xy.html",
    "momentum_split_merge.html",
    "restitution_ground.html",
    "restitution_1D_collision.html",
]

for f in files:
    text = base.joinpath(f).read_text(encoding="utf-8")
    body = text.split("<script>", 1)[0]
    script = text.split("<script>", 1)[1].split("</script>", 1)[0]
    p = IdCollector()
    p.feed(body)
    missing = sorted(js_ids(script) - p.ids)
    print(f"=== {f} missing getElementById: {len(missing)} ===")
    for m in missing:
        print(" ", m)
