"""Worked example: 29-slide walkthrough of "Attention Is All You Need" in the lecture style.
Figures were extracted beforehand into ./fig/ with scripts/pdf_figures.py:
  img128.png (Figure 1, `image` xref 128), img182/img183.png (Figure 2 left/right),
  fig1_enc.png / fig1_dec.png (PIL crops of Figure 1), table1-4.png and fig3-5.png (`clip` at 300 dpi).
Run:  uv run --with python-pptx --with pymupdf --with pillow --with numpy --with matplotlib \
        python example_transformer_build.py deck.pptx prev
It uses the low-level primitives directly; newer decks can use the components
(title_slide, overview_slide, s.stat, s.card, s.steps, s.mapping, s.formula, s.timeline, s.checklist).
"""
import sys, os, numpy as np
sys.path.insert(0, os.path.expanduser("~/.claude/skills/lecture-slides/scripts"))
from slidekit import *

OUT, PREV = sys.argv[1], sys.argv[2]
F = "fig/"
# colors taken from the paper's Figure 1
ATT, FFN, NORM, EMB, LIN, SM = "FCE0B6", "C3E7F5", "F2F5C4", "FADADD", "DADCF0", "CDE8D2"
PINK = "F2C4C4"

D = Deck()

# ---------- 1. title ----------
s = D.new("Title. This lecture walks through Vaswani et al. (2017) section by section, using the paper's own figures and tables.")
s.text(1.2, 2.05, 10.9, 0.6, P("Attention Is All You Need (NeurIPS 2017)", size=28, align="center"))
s.text(1.2, 2.75, 10.9, 1.0, P("{{The Transformer, Explained}}", size=48, align="center"))
s.text(1.6, 4.25, 10.1, 0.9, P("Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, "
                              "Aidan N. Gomez, Łukasz Kaiser, Illia Polosukhin", size=18, align="center"))
s.text(1.2, 5.35, 10.9, 0.4, P("A paper walkthrough  ·  arXiv:1706.03762", size=16, color=GRAY, align="center"))

# ---------- overview / dividers ----------
OV = ["Motivation: why drop recurrence? (10 mins)",
      "Model architecture: encoder–decoder stacks (10 mins)",
      "Attention: scaled dot-product & multi-head (20 mins)",
      "Other components: FFN, embeddings, positions (10 mins)",
      "Why self-attention? (5 mins)",
      "Training & results (15 mins)",
      "What does attention learn? (5 mins)"]

def overview(cur=None):
    s = D.new("Roadmap. " + ("" if cur is None else f"We are now at: {OV[cur]}"))
    s.title("Lecture Overview")
    ps = []
    for k, t in enumerate(OV):
        if cur is None:
            ps.append(P(t, size=24, bullet=True, after=20))
        elif k == cur:
            ps.append(P([R(t, b=True, color=RED)], size=24, bullet=True, after=20))
        else:
            ps.append(P(t, size=24, bullet=True, after=20, color="9A9A9A"))
    s.text(0.8, 1.6, 8.9, 5.2, ps)
    s.pic(F + "img128.png", 9.7, 1.25, 3.3, 5.35)
    s.cite(9.4, 6.65, 3.6, "(Figure 1, Vaswani et al., 2017)", size=12)
    return s

overview()

# ---------- 3. RNN motivation ----------
s = D.new("Recurrent models compute h_t from h_{t-1}: the chain on the right must be walked one step at a time, "
          "so we cannot parallelize within a sequence, and information between distant tokens passes through many steps.")
s.title("Sequence Transduction Before 2017: Recurrence")
s.text(0.6, 1.45, 6.0, 0.45, P("Recurrent models factor computation along positions:", size=18))
s.text(0.6, 2.05, 6.0, 0.6, P(math("h_{t} = f(h_{t−1}, x_{t})"), size=30, align="center"))
s.text(0.6, 2.95, 6.0, 3.6, [
    P("[[Inherently sequential]]: each step waits for the previous one", size=19, bullet=True, after=10),
    P("No parallelism __within__ a training example", size=19, bullet=True, after=10),
    P("Signals between distant tokens travel through O(n) steps", size=19, bullet=True, after=10),
    P("Memory limits batching across long sequences", size=19, bullet=True, after=10)])
words = ["The", "cat", "sat", "on", "mats"]
x0 = 7.1
for k, w in enumerate(words):
    x = x0 + k * 1.15
    s.rect(x, 2.7, 0.85, 0.65, "E8E8E8", "7A7A7A", 1, rounded=True, ps=P(math(f"h_{{{k + 1}}}"), size=20))
    s.rect(x, 4.35, 0.85, 0.55, EMB, "7A7A7A", 1, rounded=True, ps=P(w, size=15))
    s.line(x + 0.425, 4.33, x + 0.425, 3.38, INK, 1.5, arrow=True)
    if k:
        s.line(x - 0.29, 3.025, x - 0.02, 3.025, RED, 2, arrow=True)
s.text(7.1, 2.05, 5.6, 0.4, P("[[one step at a time  →]]", size=16, align="center"))
s.text(7.1, 5.2, 5.6, 0.8, P("The path from “The” to $h_{5}$ is 4 sequential steps; "
                             "for a 100-token sentence it is 99.", size=15, color=GRAY, align="center"))

# ---------- 4. earlier fixes ----------
s = D.new("Attention already helped RNNs, and convolutional models parallelize, but distant positions still need "
          "many steps or layers. The Transformer makes the path length constant.")
s.title("Earlier Fixes and Their Limits")
cards = [("RNN + Attention", "(Bahdanau et al., 2015)", "O(n)",
          ["Attention aligns source and target", "Still sequential inside encoder and decoder"]),
         ("Convolutional Seq2Seq", "(ByteNet, 2016; ConvS2S, 2017)", "O(log_{k} n)",
          ["Parallel over positions", "Distant positions need a stack of layers (ConvS2S: O(n/k))"]),
         ("Transformer", "(Vaswani et al., 2017)", "O(1)",
          ["Self-attention links every pair of positions directly", "Constant number of sequential operations"])]
for k, (h, c, stat, bl) in enumerate(cards):
    x = 0.6 + k * 4.15
    last = k == 2
    s.rect(x, 1.45, 3.8, 4.6, "FBF1F1" if last else LIGHT, RED if last else None, 1.5, rounded=True)
    s.text(x + 0.3, 1.65, 3.3, 0.45, P([R(h, b=True, color=RED if last else INK)], size=19))
    s.text(x + 0.3, 2.1, 3.2, 0.35, P(c, size=13, color=GRAY))
    s.text(x + 0.3, 2.6, 3.2, 0.3, P("maximum path length", size=13, color=GRAY))
    s.text(x + 0.3, 2.9, 3.2, 0.75, P(math(stat, color=RED if last else INK, b=True), size=36))
    s.text(x + 0.3, 3.85, 3.25, 2.1, [P(t, size=16, bullet=True, after=8) for t in bl])
s.text(0.6, 6.3, 12.1, 0.5, P("Key question: {{what if we drop recurrence and convolution entirely?}}", size=21, align="center"))

# ---------- 5. key idea ----------
s = D.new("The whole paper in one sentence, plus the three numbers that made people pay attention.")
s.title("The Transformer in One Sentence")
s.text(1.2, 1.5, 10.9, 1.1, P([R("“…relying entirely on an attention mechanism to draw global dependencies "
                                 "between input and output.”", i=True, color=RED)], size=26, align="center"))
s.cite(1.2, 2.7, 10.9, "(Vaswani et al., 2017)", size=14)
stats = [("28.4", "BLEU on WMT14 EN→DE", "+2.0 over the best prior results, including ensembles"),
         ("41.8", "BLEU on WMT14 EN→FR", "new single-model state of the art"),
         ("3.5 days", "on 8 P100 GPUs", "big model; the base model trains in 12 hours")]
for k, (n, l, sub) in enumerate(stats):
    x = 0.9 + k * 4.05
    s.text(x, 3.6, 3.5, 1.05, P([R(n, b=True, color=RED)], size=60, align="center"))
    s.text(x, 4.75, 3.5, 0.45, P([R(l, b=True)], size=19, align="center"))
    s.text(x, 5.25, 3.5, 0.8, P(sub, size=15, color=GRAY, align="center"))
    if k:
        s.line(x - 0.28, 3.7, x - 0.28, 5.9, MID, 1)

# ---------- 6. divider ----------
overview(1)

# ---------- 7. architecture ----------
s = D.new("Figure 1 of the paper. Left stack is the encoder, right stack the decoder; each is N = 6 identical layers. "
          "The arrow crossing between stacks carries the encoder output into every decoder layer.")
s.title("Model Architecture")
s.pic(F + "img128.png", 0.6, 1.2, 4.4, 5.55)
s.cite(0.6, 6.8, 4.4, "(Figure 1, Vaswani et al., 2017)", size=12)
rows = [("Inputs", "Token embedding + positional encoding"),
        ("Left stack", "Encoder: N = 6 identical layers"),
        ("Right stack", "Decoder: N = 6 identical layers"),
        ("Crossing arrow", "Encoder output → keys & values for the decoder"),
        ("Outputs (shifted right)", "Target tokens generated so far"),
        ("Linear + Softmax", "Distribution over the next token")]
for k, (a, b) in enumerate(rows):
    y = 1.45 + k * 0.8
    s.text(5.2, y, 2.9, 0.7, P(a, size=18, color=GRAY, align="right"), anchor="middle")
    s.text(8.25, y, 0.5, 0.7, P("→", size=18, color=GRAY, align="center"), anchor="middle")
    s.text(8.9, y, 3.9, 0.7, P([R(b, b=True)], size=18), anchor="middle")
s.text(5.2, 6.35, 7.6, 0.55, P("Encoder: $x$ = ($x_{1}$, …, $x_{n}$) → $z$ = ($z_{1}$, …, $z_{n}$).  "
                               "Decoder: $z$ → $y$ = ($y_{1}$, …, $y_{m}$), one symbol at a time.",
                               size=15, color=GRAY))

# ---------- 8. encoder ----------
s = D.new("Each encoder layer is two sub-layers wrapped in residual + LayerNorm. Keeping every output at 512 dims "
          "is what makes the residual additions possible.")
s.title("Encoder: N = 6 Identical Layers")
s.pic(F + "fig1_enc.png", 0.7, 1.3, 3.2, 5.3)
s.cite(0.5, 6.7, 3.6, "(Figure 1, left)", size=12)
s.text(4.5, 1.5, 8.2, 3.0, [
    P("Sub-layer 1: [[multi-head self-attention]]", size=21, bullet=True, after=12),
    P("Sub-layer 2: position-wise [[feed-forward network]]", size=21, bullet=True, after=12),
    P("A residual connection around each sub-layer, followed by layer normalization", size=21, bullet=True, after=12),
    P("All sub-layers and embeddings output $d_{model}$ = 512 dimensions, so the residual additions line up",
      size=21, bullet=True, after=12)])
s.rect(4.5, 4.85, 8.2, 1.15, LIGHT, rounded=True,
       ps=P(math("output = LayerNorm( x + Sublayer(x) )"), size=30))
s.text(4.5, 6.15, 8.2, 0.4, P("Sublayer is either self-attention or the FFN; dropout is applied to its output before the add.",
                              size=14, color=GRAY, align="center"))

# ---------- 9. decoder ----------
s = D.new("The decoder adds a third sub-layer that attends to the encoder output, and masks its own self-attention. "
          "The shifted-right input is what makes teacher forcing work: the input at i is the target at i-1.")
s.title("Decoder: Masked Self-Attention + Cross-Attention")
s.text(0.6, 1.45, 9.0, 3.2, [
    P("Same N = 6 layers, plus a [[third sub-layer]]: multi-head attention over the encoder output", size=20, bullet=True, after=10),
    P("Self-attention is [[masked]]: position $i$ may only attend to positions ≤ $i$", size=20, bullet=True, after=10),
    P("Output embeddings are [[shifted right]] by one, so the prediction for position $i$ depends only on outputs before $i$",
      size=20, bullet=True, after=10),
    P("At inference, generate one token at a time and feed it back in", size=20, bullet=True, after=10)])
ins, outs = ["<bos>", "I", "love", "you"], ["I", "love", "you", "<eos>"]
s.text(0.6, 4.95, 2.0, 0.5, P("predict", size=16, color=GRAY, align="right"), anchor="middle")
s.text(0.6, 6.05, 2.0, 0.5, P("decoder input", size=16, color=GRAY, align="right"), anchor="middle")
for k in range(4):
    x = 2.9 + k * 1.5
    s.rect(x, 4.95, 1.2, 0.5, SM, "7A7A7A", 1, rounded=True, ps=P(outs[k], size=16, font="Courier New"))
    s.rect(x, 6.05, 1.2, 0.5, EMB, "7A7A7A", 1, rounded=True, ps=P(ins[k], size=16, font="Courier New"))
    s.line(x + 0.6, 6.03, x + 0.6, 5.48, INK, 1.25, arrow=True)
s.pic(F + "fig1_dec.png", 10.35, 1.2, 2.2, 5.55)
s.cite(10.0, 6.8, 2.9, "(Figure 1, right)", size=12)

# ---------- 10. divider ----------
overview(2)

# ---------- 11. soft lookup ----------
s = D.new("Intuition before the formula: a dictionary returns the value of the one matching key; attention scores the "
          "query against every key and returns a softmax-weighted mix of all values. Numbers here are illustrative.")
s.title("Attention as a Soft Dictionary Lookup")
s.text(0.6, 1.3, 12.1, 0.5, P("Attention maps a [[query]] and a set of [[key–value pairs]] to an output: "
                              "a weighted sum of the values.", size=20))
scores, alphas = [2.1, 0.3, 1.2, -0.5], [0.60, 0.10, 0.25, 0.05]
s.rect(0.6, 3.45, 1.15, 0.65, ATT, "7A7A7A", 1, rounded=True, ps=P(math("q"), size=22))
s.text(2.3, 2.05, 1.0, 0.3, P("keys", size=13, color=GRAY, align="center"))
s.text(3.45, 2.05, 1.3, 0.3, P("score", size=13, color=GRAY, align="center"))
s.text(4.9, 2.05, 1.4, 0.3, P("weight α", size=13, color=GRAY))
s.text(6.45, 2.05, 0.8, 0.3, P("values", size=13, color=GRAY, align="center"))
for j in range(4):
    y = 2.45 + j * 0.78
    s.line(1.77, 3.775, 2.28, y + 0.28, "9A9A9A", 1)
    s.rect(2.3, y, 1.0, 0.56, "E8E8E8", "7A7A7A", 1, rounded=True, ps=P(math(f"k_{{{j + 1}}}"), size=18))
    s.text(3.45, y, 1.3, 0.56, P(math(f"q·k_{{{j + 1}}}") + [R(f" = {scores[j]}")], size=14, align="center"), anchor="middle")
    s.rect(4.9, y + 0.13, 0.95 * alphas[j] / 0.6, 0.3, RED if j == 0 else "D99A9A")
    s.text(4.95 + 0.95 * alphas[j] / 0.6, y, 0.55, 0.56, P(f"{alphas[j]:.2f}", size=13, color=GRAY), anchor="middle")
    s.rect(6.45, y, 0.8, 0.56, FFN, "7A7A7A", 1, rounded=True, ps=P(math(f"v_{{{j + 1}}}"), size=18))
    s.line(7.27, y + 0.28, 7.75, 3.775, "9A9A9A", 1)
s.rect(7.8, 3.45, 1.0, 0.65, SM, "7A7A7A", 1, rounded=True, ps=P("out", size=18))
s.text(0.6, 5.7, 8.2, 0.6, P(math("output = Σ_{i} α_{i} v_{i} ,    α = softmax( q·k_{1}, …, q·k_{n} )"), size=22, align="center"))
for k, (h, t) in enumerate([("Python dict", "Exact key match → returns exactly one value; no match → error"),
                            ("Attention", "Similarity with every key → returns a weighted mix of all values; "
                                          "fully differentiable")]):
    y = 2.1 + k * 2.1
    s.rect(9.3, y, 3.45, 1.8, "FBF1F1" if k else LIGHT, RED if k else None, 1.25, rounded=True)
    s.text(9.5, y + 0.15, 3.1, 0.4, P([R(h, b=True, color=RED if k else INK)], size=19))
    s.text(9.5, y + 0.6, 3.1, 1.15, P(t, size=15))

# ---------- 12. scaled dot-product ----------
s = D.new("Walk through Figure 2 (left) bottom-up. Q, K are n x d_k, V is n x d_v. Mask is only used in the decoder.")
s.title("Scaled Dot-Product Attention")
s.pic(F + "img182.png", 0.8, 1.3, 2.7, 5.25)
s.cite(0.4, 6.65, 3.5, "(Figure 2, left)", size=12)
s.rect(4.2, 1.35, 8.5, 1.1, LIGHT, rounded=True,
       ps=P(math("Attention(Q, K, V) = softmax( QK^{T} / √d_{k} ) V"), size=30))
steps = ["**MatMul**: scores $QK^{T}$, every query against every key (n × n)",
         "**Scale**: divide by √$d_{k}$ to keep the logits in a healthy range",
         "**Mask** (optional): set illegal connections to −∞ (decoder only)",
         "**SoftMax**: normalize each row into attention weights",
         "**MatMul**: weighted sum of the values $V$"]
for k, t in enumerate(steps):
    y = 2.85 + k * 0.74
    s.oval(4.2, y + 0.07, 0.42, 0.42, RED)
    s.text(4.2, y + 0.07, 0.42, 0.42, P([R(str(k + 1), b=True, color="FFFFFF")], size=15, align="center"), anchor="middle")
    s.text(4.85, y, 7.85, 0.56, P(t, size=19), anchor="middle")

# ---------- 13. why scale ----------
rng = np.random.default_rng(7)
dk = 64
q = rng.standard_normal(dk); K = rng.standard_normal((8, dk))
logit = K @ q
sm = lambda z: np.exp(z - z.max()) / np.exp(z - z.max()).sum()
un, sc = sm(logit), sm(logit / np.sqrt(dk))
s = D.new(f"Simulated with random q, k in R^64. Unscaled logits have std about 8; the softmax puts {un.max():.2f} "
          f"of the mass on one key. After scaling, the max weight is {sc.max():.2f} and gradients flow to all keys.")
s.title("Why Scale by $1 / √d_{k}$?")
s.text(0.6, 1.45, 5.7, 5.0, [
    P("If the components of $q$ and $k$ are independent with mean 0 and variance 1, then "
      "$q · k$ = Σ $q_{i} k_{i}$ has variance $d_{k}$", size=18, bullet=True, after=10),
    P("With $d_{k}$ = 64 the logits have std ≈ 8, and softmax becomes nearly one-hot", size=18, bullet=True, after=10),
    P("A saturated softmax has [[extremely small gradients]]", size=18, bullet=True, after=10),
    P("Dividing by √$d_{k}$ restores unit variance", size=18, bullet=True, after=16),
    P("Without scaling, additive attention beats dot-product attention for larger $d_{k}$ (Britz et al., 2017)",
      size=15, color=GRAY)])
s.chart("col", 6.6, 1.3, 6.2, 5.2, [f"k{j + 1}" for j in range(8)],
        [("softmax(q·k)", [round(float(v), 3) for v in un]), ("softmax(q·k / √dk)", [round(float(v), 3) for v in sc])],
        [RED, "9AA0A6"], title="Attention weights over 8 keys (dk = 64)", numfmt="0.0")
s.cite(6.6, 6.55, 6.2, "Simulated with random Gaussian q and k", size=12)

# ---------- 14. multi-head ----------
s = D.new("Eight heads with d_k = 64 cost about the same as one head with d = 512, but each head can specialize. "
          "Figure 2 right: h parallel scaled dot-product attentions, concat, final linear.")
s.title("Multi-Head Attention")
s.pic(F + "img183.png", 0.7, 1.3, 3.3, 5.1)
s.cite(0.5, 6.5, 3.7, "(Figure 2, right)", size=12)
s.rect(4.5, 1.3, 8.2, 1.4, LIGHT, rounded=True, ps=[
    P(math("MultiHead(Q, K, V) = Concat(head_{1}, …, head_{h}) W^{O}"), size=23, after=4),
    P(math("head_{i} = Attention(QW_{i}^{Q}, KW_{i}^{K}, VW_{i}^{V})"), size=23)])
s.text(4.5, 2.95, 8.2, 2.3, [
    P("Project Q, K, V [[h times]] with different learned matrices, attend in parallel, concatenate, project again",
      size=18, bullet=True, after=8),
    P("Lets the model attend to [[different representation subspaces]] at different positions", size=18, bullet=True, after=8),
    P("With a single head, averaging inhibits this", size=18, bullet=True, after=8)])
for k, (n, l) in enumerate([("h = 8", "parallel heads"), ("$d_{k}$ = $d_{v}$ = 64", "= $d_{model}$ / h per head"),
                            ("≈ 1×", "cost of one full-width head")]):
    x = 4.5 + k * 2.8
    s.text(x, 5.35, 2.6, 0.7, P("{{" + n + "}}" if "$" not in n else n, size=28, align="center",
                                color=RED, b=True), anchor="middle")
    s.text(x, 6.05, 2.6, 0.4, P(l, size=15, color=GRAY, align="center"))

# ---------- 15. three uses ----------
s = D.new("The same attention block is used in three places; only where Q, K and V come from changes.")
s.title("Three Ways the Transformer Uses Attention")
uses = [("Encoder self-attention", [("Q, K, V", "previous encoder layer")],
         "Each position attends to [[all]] positions of the input"),
        ("Masked decoder self-attention", [("Q, K, V", "previous decoder layer")],
         "Each position attends to positions [[up to and including]] itself"),
        ("Encoder–decoder attention", [("Q", "previous decoder layer"), ("K, V", "encoder output")],
         "Every decoder position attends over [[the whole input]], like classic seq2seq attention")]
where = ["Figure 1: orange block in the left (encoder) stack",
         "Figure 1: “Masked Multi-Head Attention” at the bottom of the decoder",
         "Figure 1: middle orange block of the decoder, fed by the encoder"]
for k, (h, chips, desc) in enumerate(uses):
    x = 0.6 + k * 4.15
    s.rect(x, 1.45, 3.8, 4.9, LIGHT, rounded=True)
    s.text(x + 0.3, 1.65, 3.2, 0.8, P([R(h, b=True)], size=20))
    for c, (lab, src) in enumerate(chips):
        y = 2.6 + c * 0.7
        s.rect(x + 0.3, y, 0.95, 0.5, ATT, "7A7A7A", 1, rounded=True, ps=P(math(lab), size=15))
        s.text(x + 1.4, y, 2.2, 0.5, P("← " + src, size=15), anchor="middle")
    s.text(x + 0.3, 3.9, 3.2, 1.6, P(desc, size=17))
    s.text(x + 0.3, 5.45, 3.2, 0.75, P(where[k], size=13, color=GRAY))
s.text(0.6, 6.5, 12.1, 0.4, P("Same block, three wirings: only the sources of Q, K and V differ.", size=16,
                              color=GRAY, align="center"))

# ---------- 16. masking ----------
s = D.new("Row = query position, column = key position. Upper triangle is masked with minus infinity, so after softmax "
          "those weights are zero. Training still runs all positions in parallel.")
s.title("Masking Preserves the Auto-Regressive Property")
toks = ["<bos>", "I", "love", "you"]
gx, gy, c = 2.1, 2.2, 0.85
s.text(gx, 1.45, 4 * c, 0.3, P("keys →", size=14, color=GRAY, align="center"))
s.text(0.5, 1.45, 1.5, 0.3, P("queries ↓", size=14, color=GRAY, align="right"))
for i, t in enumerate(toks):
    s.text(gx + i * c, 1.8, c, 0.35, P(t, size=13, font="Courier New", align="center"))
    s.text(0.5, gy + i * c, 1.5, c, P(t, size=13, font="Courier New", align="right"), anchor="middle")
    for j in range(4):
        ok = j <= i
        s.rect(gx + j * c, gy + i * c, c, c, PINK if ok else LIGHT, "FFFFFF", 2,
               ps=P("" if ok else "−∞", size=15, color="9A9A9A"))
s.text(0.6, 5.85, 5.4, 0.8, P("pink = allowed;  gray = masked (−∞ before softmax → weight 0)", size=13, color=GRAY, align="center"))
s.text(6.4, 1.6, 6.3, 5.0, [
    P("Decoder self-attention must not look at [[future tokens]]", size=19, bullet=True, after=12),
    P("Implemented inside scaled dot-product attention: add −∞ to the scores of illegal connections before the softmax",
      size=19, bullet=True, after=12),
    P("After the softmax those weights are exactly 0", size=19, bullet=True, after=12),
    P("Training: all positions computed [[in parallel]] (teacher forcing)", size=19, bullet=True, after=12),
    P("Inference: still generates [[one token at a time]]", size=19, bullet=True, after=12)])

# ---------- 17. FFN & embeddings ----------
s = D.new("FFN: 512 -> 2048 -> 512 with ReLU, applied to each position separately. Embeddings: one matrix shared "
          "three ways (Press & Wolf, 2016), scaled by sqrt(d_model).")
s.title("Feed-Forward Networks & Embeddings")
s.text(0.6, 1.35, 6.0, 0.45, P([R("Position-wise FFN", b=True)], size=21))
s.rect(0.6, 1.9, 6.0, 0.8, LIGHT, rounded=True, ps=P(math("FFN(x) = max(0, xW_{1} + b_{1}) W_{2} + b_{2}"), size=23))
for k, (n, hh, lab) in enumerate([(512, 1.0, "512"), (2048, 2.0, "2048 + ReLU"), (512, 1.0, "512")]):
    x = 1.3 + k * 2.0
    s.rect(x, 3.95 - hh / 2, 0.55, hh, FFN, "7A7A7A", 1)
    s.text(x - 0.7, 5.05, 1.95, 0.3, P(lab, size=14, color=GRAY, align="center"))
    if k:
        s.line(x - 1.35, 3.95, x - 0.1, 3.95, INK, 1.5, arrow=True)
s.text(0.6, 5.5, 6.0, 1.4, [P("Applied to each position [[separately and identically]]", size=16, bullet=True, after=4),
                            P("Shared across positions; different parameters in each layer", size=16, bullet=True, after=4),
                            P("Same as two convolutions with kernel size 1", size=16, bullet=True)])
s.line(6.9, 1.4, 6.9, 6.8, MID, 1)
s.text(7.2, 1.35, 5.5, 0.45, P([R("Embeddings & Softmax", b=True)], size=21))
s.text(7.2, 1.9, 5.5, 2.5, [
    P("Learned embeddings map tokens to vectors of size $d_{model}$ = 512", size=17, bullet=True, after=8),
    P("[[One weight matrix]] shared by the input embedding, the output embedding and the pre-softmax linear layer",
      size=17, bullet=True, after=8),
    P("Embedding weights are multiplied by √$d_{model}$", size=17, bullet=True)])
s.rect(8.95, 4.65, 2.0, 0.6, RED, ps=P([R("shared W", b=True, color="FFFFFF")], size=16))
for k, t in enumerate(["input embedding", "output embedding", "pre-softmax linear"]):
    x = 7.2 + k * 1.9
    s.rect(x, 5.95, 1.75, 0.6, [EMB, EMB, LIN][k], "7A7A7A", 1, rounded=True, ps=P(t, size=13))
    s.line(x + 0.875, 5.93, 9.95, 5.27, "9A9A9A", 1.25)

# ---------- 18. positional encoding ----------
pos = list(range(0, 61))
def pe(dim):
    i = dim // 2
    return [round(float(np.sin(p / 10000 ** (2 * i / 512))), 3) for p in pos]
s = D.new("Each dimension is a sinusoid with a different wavelength. Low dimensions change fast, high dimensions slowly, "
          "which gives every position a unique pattern and makes relative offsets a linear map.")
s.title("Positional Encoding")
s.rect(0.6, 1.35, 5.8, 1.3, LIGHT, rounded=True, ps=[
    P(math("PE_{(pos, 2i)} = sin( pos / 10000^{2i/d} )"), size=21, after=4),
    P(math("PE_{(pos, 2i+1)} = cos( pos / 10000^{2i/d} )"), size=21)])
s.text(0.6, 2.72, 5.8, 0.3, P("d = $d_{model}$ = 512,  i = dimension index", size=13, color=GRAY, align="center"))
s.text(0.6, 3.15, 5.8, 3.7, [
    P("No recurrence, no convolution → without this, the model cannot tell word order", size=16, bullet=True, after=6),
    P("[[Added]] to the input embeddings at the bottom of both stacks", size=16, bullet=True, after=6),
    P("Wavelengths form a geometric progression from 2π to 10000 · 2π", size=16, bullet=True, after=6),
    P("For a fixed offset k, $PE_{pos+k}$ is a [[linear function]] of $PE_{pos}$", size=16, bullet=True, after=6),
    P("Learned positional embeddings: nearly identical results (Table 3, row E)", size=16, bullet=True)])
s.chart("line", 6.7, 1.3, 6.1, 5.4, pos, [("dim 32", pe(32)), ("dim 64", pe(64)), ("dim 128", pe(128)), ("dim 256", pe(256))],
        [RED, "E07B39", "3B7EA1", "5F6368"], title="PE value vs. position (even dims, sine)",
        xtitle="position", numfmt="0.0", xtick_every=10)

# ---------- 19. why self-attention ----------
s = D.new("Table 1. For typical sentence lengths n is smaller than d = 512, so self-attention is also cheaper "
          "per layer than recurrence, on top of being parallel and having constant path length.")
s.title("Why Self-Attention?")
s.pic(F + "table1.png", 1.6, 1.2, 10.1, 2.25)
s.cite(0.6, 3.5, 12.1, "(Table 1)  n: sequence length,  d: representation dim,  k: kernel size,  "
       "r: neighborhood size in restricted self-attention", size=12)
crit = [("Computation per layer", "Faster than recurrence when n < d, the usual case for word-piece / BPE sentences"),
        ("Parallelism", "O(1) sequential operations vs. O(n) for recurrent layers: all positions at once"),
        ("Path length", "O(1) between any two positions, so long-range dependencies are easier to learn")]
for k, (h, t) in enumerate(crit):
    x = 0.6 + k * 4.15
    s.rect(x, 4.05, 3.8, 2.3, LIGHT, rounded=True)
    s.text(x + 0.25, 4.2, 3.3, 0.45, P([R(h, b=True, color=RED)], size=19))
    s.text(x + 0.25, 4.75, 3.3, 1.5, P(t, size=16))
s.text(0.6, 6.5, 12.1, 0.4, P("Bonus: attention heads are more [[interpretable]] (see the visualizations later)",
                              size=15, color=GRAY, align="center"))

# ---------- 20. divider ----------
overview(5)

# ---------- 21. training setup ----------
s = D.new("Data and compute. The big model's 3.5 days on 8 P100s was cheap compared with the models in Table 2.")
s.title("Training Setup")
s.text(0.6, 1.35, 6.0, 0.45, P([R("Data", b=True)], size=22))
for k, (h, t) in enumerate([("WMT 2014 English–German", "≈ 4.5M sentence pairs; byte-pair encoding, shared vocabulary of ≈ 37K tokens"),
                            ("WMT 2014 English–French", "36M sentences; 32K word-piece vocabulary"),
                            ("Batching", "Sentence pairs grouped by length; ≈ 25K source + 25K target tokens per batch")]):
    y = 1.95 + k * 1.5
    s.text(0.6, y, 6.0, 0.4, P([R(h, b=True, color=RED)], size=18))
    s.text(0.6, y + 0.42, 6.0, 0.95, P(t, size=17))
s.line(6.9, 1.4, 6.9, 6.8, MID, 1)
s.text(7.2, 1.35, 5.5, 0.45, P([R("Hardware & Schedule", b=True)], size=22))
s.text(7.2, 1.95, 5.5, 0.4, P("8 × NVIDIA P100 GPUs, one machine", size=18))
s.text(7.2, 2.7, 5.5, 0.3, P("wall-clock training time", size=13, color=GRAY))
for k, (lab, hrs, det, col) in enumerate([("base", 12, "100K steps × 0.4 s", "9AA0A6"),
                                           ("big", 84, "300K steps × 1.0 s", RED)]):
    y = 3.15 + k * 1.3
    s.text(7.2, y, 0.8, 0.5, P([R(lab, b=True)], size=17), anchor="middle")
    s.rect(8.0, y, 4.6 * hrs / 84, 0.5, col)
    s.text(8.0 + 4.6 * hrs / 84 + 0.12 if k == 0 else 8.1, y, 3.0, 0.5,
           P([R("12 hours" if k == 0 else "3.5 days", b=True, color=INK if k == 0 else "FFFFFF")], size=16), anchor="middle")
    s.text(8.0, y + 0.55, 4.6, 0.35, P(det, size=14, color=GRAY))
s.text(7.2, 5.9, 5.5, 0.8, P("Base model: $d_{model}$ = 512, 65M parameters.  Big: $d_{model}$ = 1024, 213M parameters.",
                             size=15, color=GRAY))

# ---------- 22. optimizer ----------
steps_ = list(range(0, 40001, 500))
lr = [round(512 ** -0.5 * min(max(t, 1) ** -0.5, max(t, 1) * 4000 ** -1.5), 6) for t in steps_]
s = D.new("Warmup: linear increase for 4000 steps, then inverse square-root decay. Peak LR is about 7e-4 for d_model = 512.")
s.title("Optimizer, Learning-Rate Schedule & Regularization")
s.text(0.6, 1.35, 6.0, 0.45, P([R("Adam: ", b=True)] + math("β_{1} = 0.9,  β_{2} = 0.98,  ε = 10^{−9}"), size=20))
s.rect(0.6, 1.95, 6.0, 0.85, LIGHT, rounded=True,
       ps=P(math("lrate = d_{model}^{−0.5} · min( step^{−0.5}, step · warmup^{−1.5} )"), size=19))
s.text(0.6, 2.9, 6.0, 0.4, P("warmup = 4000 steps: linear increase, then decay ~ 1/√step", size=15, color=GRAY))
s.text(0.6, 3.6, 6.0, 0.45, P([R("Regularization", b=True)], size=21))
s.text(0.6, 4.15, 6.0, 2.6, [
    P("[[Residual dropout]] $P_{drop}$ = 0.1 on every sub-layer output and on the embedding + PE sums",
      size=17, bullet=True, after=10),
    P("[[Label smoothing]] $ε_{ls}$ = 0.1: hurts perplexity, but improves accuracy and BLEU", size=17, bullet=True)])
s.chart("line", 6.9, 1.3, 5.9, 5.4, steps_, [("learning rate", lr)], [RED], title="Learning rate vs. training step",
        xtitle="training step", numfmt="0.0000", legend=False, xtick_every=20)

# ---------- 23. results ----------
s = D.new("Table 2. Even the base model beats all previous single models and ensembles on EN-DE, at a small fraction "
          "of the training FLOPs.")
s.title("Results: Machine Translation (WMT 2014)")
s.pic(F + "table2.png", 0.6, 1.3, 7.6, 3.4, halign="left", valign="top")
s.cite(0.6, 4.6, 7.6, "(Table 2, newstest2014)", size=12)
s.text(0.6, 5.2, 7.6, 1.2, [
    P("Inference: beam search, beam size 4, length penalty α = 0.6", size=15, bullet=True, after=4, color=GRAY),
    P("Checkpoint averaging: last 5 (base) or 20 (big) checkpoints", size=15, bullet=True, color=GRAY)])
for k, (n, l, sub) in enumerate([("28.4", "EN→DE BLEU (big)", "+2.0 over the previous best, including ensembles"),
                                 ("41.8", "EN→FR BLEU (big)", "single-model SOTA at < 1/4 the training cost of the previous best")]):
    y = 1.4 + k * 2.6
    s.text(8.7, y, 4.0, 0.95, P([R(n, b=True, color=RED)], size=54))
    s.text(8.7, y + 1.0, 4.0, 0.4, P([R(l, b=True)], size=18))
    s.text(8.7, y + 1.45, 4.0, 0.8, P(sub, size=15, color=GRAY))

# ---------- 24. ablations ----------
s = D.new("Table 3 ablations on the EN-DE dev set. Row letters match the groups in the table.")
s.title("Model Variations (Table 3)")
s.pic(F + "table3.png", 0.6, 1.25, 8.3, 5.4, halign="left")
s.cite(0.6, 6.7, 8.3, "(Table 3, EN→DE dev set newstest2013)", size=12)
finds = [("(A)", "One head is 0.9 BLEU worse; too many heads also hurts"),
         ("(B)", "Smaller $d_{k}$ hurts: compatibility is not easy to compute"),
         ("(C)", "Bigger models are better"),
         ("(D)", "Dropout is very helpful against overfitting"),
         ("(E)", "Learned positional embeddings ≈ sinusoids")]
for k, (tag, t) in enumerate(finds):
    y = 1.35 + k * 1.05
    s.text(9.2, y, 0.65, 0.9, P([R(tag, b=True, color=RED)], size=17))
    s.text(9.85, y, 2.9, 0.95, P(t, size=16))

# ---------- 25. parsing ----------
s = D.new("Table 4: English constituency parsing on WSJ section 23, with almost no task-specific tuning.")
s.title("Generalization: English Constituency Parsing")
s.pic(F + "table4.png", 0.6, 1.3, 7.4, 4.8, halign="left", valign="top")
s.cite(0.6, 4.75, 7.4, "(Table 4, WSJ section 23, F1)", size=12)
s.text(8.4, 1.4, 4.3, 5.2, [
    P("A harder test: output is long and strongly structured", size=18, bullet=True, after=10),
    P("4 layers, $d_{model}$ = 1024, little task-specific tuning", size=18, bullet=True, after=10),
    P("Unlike RNN seq2seq models, it beats the BerkeleyParser even with only 40K WSJ sentences", size=18, bullet=True, after=10),
    P("Semi-supervised: better than all prior models except the RNN Grammar", size=18, bullet=True)])
for k, (n, l) in enumerate([("91.3", "F1, WSJ only"), ("92.7", "F1, semi-supervised")]):
    x = 0.9 + k * 3.6
    s.text(x, 5.15, 3.0, 0.95, P([R(n, b=True, color=RED)], size=54, align="center"))
    s.text(x, 6.1, 3.0, 0.4, P([R(l, b=True)], size=17, align="center"))

# ---------- 26. divider-free: attention viz 1 ----------
overview(6)
s = D.new("Figure 3: encoder self-attention in layer 5. Many heads link 'making' with the distant 'more difficult'.")
s.title("What Attention Learns: Long-Distance Dependencies")
s.pic(F + "fig3.png", 0.6, 1.3, 8.4, 4.9, halign="left")
s.cite(0.6, 6.3, 8.4, "(Figure 3; colors = different heads)", size=12)
s.text(9.4, 1.5, 3.4, 5.0, [
    P("Encoder self-attention, layer 5 of 6", size=18, bullet=True, after=10),
    P("Many heads attend from “making” to distant words, completing the phrase [[“making … more difficult”]]",
      size=18, bullet=True, after=10),
    P("Each color is a different head", size=18, bullet=True)])

# ---------- 27. attention viz 2 ----------
s = D.new("Figure 4: two heads that seem to do anaphora resolution. Figure 5: heads that track sentence structure.")
s.title("What Attention Learns: Anaphora & Structure")
s.pic(F + "fig4.png", 0.6, 1.3, 4.0, 5.0)
s.cite(0.6, 6.4, 4.0, "(Figure 4)", size=12)
s.pic(F + "fig5.png", 4.9, 1.3, 4.1, 5.0)
s.cite(4.9, 6.4, 4.1, "(Figure 5)", size=12)
s.text(9.4, 1.5, 3.4, 5.0, [
    P("Fig. 4: two heads in layer 5 appear to do [[anaphora resolution]]; attention from “its” is very sharp",
      size=17, bullet=True, after=12),
    P("Fig. 5: different heads learn different behaviors related to [[sentence structure]]", size=17, bullet=True)])

# ---------- 28. summary ----------
s = D.new("Recap, then where the architecture went next.")
s.title("Lecture Summary")
summ = [("Motivation", "recurrence blocks parallelism and makes long-range paths long"),
        ("Architecture", "6 + 6 layers of attention + FFN, each with residual + LayerNorm"),
        ("Attention", "softmax(QKᵀ / √dk) V, 8 heads, masked in the decoder"),
        ("Positions", "sinusoidal encodings inject word order"),
        ("Results", "SOTA BLEU at a fraction of the training cost; transfers to parsing")]
s.text(0.8, 1.4, 11.8, 3.6, [P([R("✓  ", b=True, color=RED, font="Arial Unicode MS"), R(a, b=True), R(": " + b)], size=20, after=10)
                             for a, b in summ])
s.line(0.9, 5.75, 12.4, 5.75, MID, 1.5)
tl = [("2017", "Transformer"), ("2018", "BERT, GPT"), ("2020", "GPT-3, ViT"), ("2022", "ChatGPT"), ("today", "LLM agents")]
for k, (yr, nm) in enumerate(tl):
    x = 1.6 + k * 2.5
    s.text(x - 1.0, 5.2, 2.0, 0.35, P(yr, size=16, align="center"))
    s.oval(x - 0.09, 5.66, 0.18, 0.18, RED if k in (0, 4) else "9A9A9A")
    s.text(x - 1.2, 6.0, 2.4, 0.4, P([R(nm, b=True)], size=18, align="center"))

D.save(OUT, PREV)
print(len(D.slides), "slides")
print("\n".join(D.warnings) or "no layout warnings")
