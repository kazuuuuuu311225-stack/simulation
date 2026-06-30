#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
結晶格子の3D可視化シミュレーション
SC（単純立方）・BCC（体心立方）・FCC（面心立方）を3D散布図で表示します。
"""

import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401  （3D表示に必要）


# --- 格子定数（1辺の長さを 1 とした立方体を基本単位とする） ---
LATTICE_SPACING = 1.0

# --- 何個分の単位胞を並べて表示するか（見やすさのため 2×2×2） ---
CELLS_X = 2
CELLS_Y = 2
CELLS_Z = 2


def generate_sc_lattice(cells_x, cells_y, cells_z):
    """
    SC（単純立方格子）の格子点を作る。

    立方体の「頂点」だけに原子（格子点）がある構造。
    座標は整数 (0, 1, 2, …) の組み合わせになる。
    """
    points = []
    for i in range(cells_x + 1):
        for j in range(cells_y + 1):
            for k in range(cells_z + 1):
                x = i * LATTICE_SPACING
                y = j * LATTICE_SPACING
                z = k * LATTICE_SPACING
                points.append([x, y, z])
    return np.array(points)


def generate_bcc_lattice(cells_x, cells_y, cells_z):
    """
    BCC（体心立方格子）の格子点を作る。

    1つの立方体に対して
      ・8つの頂点
      ・立方体の真ん中（体心）
    の計9位置が基本。ここでは単位胞を並べ、
    頂点 (整数座標) と 体心 (0.5 ずつずれた座標) の両方を置く。
    """
    points = []
    for i in range(cells_x):
        for j in range(cells_y):
            for k in range(cells_z):
                # この単位胞の左下前の角の座標
                ox = i * LATTICE_SPACING
                oy = j * LATTICE_SPACING
                oz = k * LATTICE_SPACING

                # 8つの頂点（立方体の角）
                for dx in (0.0, 1.0):
                    for dy in (0.0, 1.0):
                        for dz in (0.0, 1.0):
                            points.append([ox + dx, oy + dy, oz + dz])

                # 体心（立方体の中心）
                points.append([
                    ox + 0.5 * LATTICE_SPACING,
                    oy + 0.5 * LATTICE_SPACING,
                    oz + 0.5 * LATTICE_SPACING,
                ])

    # 隣の単位胞と重なる点を除いて、見やすく整理する
    return _unique_points(points)


def generate_fcc_lattice(cells_x, cells_y, cells_z):
    """
    FCC（面心立方格子）の格子点を作る。

    1つの立方体に対して
      ・8つの頂点
      ・6つの面それぞれの中心
    に原子がある。面の中心は、2方向が 0.5、もう1方向が 0 または 1 になる。
    """
    points = []
    for i in range(cells_x):
        for j in range(cells_y):
            for k in range(cells_z):
                ox = i * LATTICE_SPACING
                oy = j * LATTICE_SPACING
                oz = k * LATTICE_SPACING

                # 8つの頂点
                for dx in (0.0, 1.0):
                    for dy in (0.0, 1.0):
                        for dz in (0.0, 1.0):
                            points.append([ox + dx, oy + dy, oz + dz])

                # 6つの面の中心（各面で「一定方向」だけ 0.5）
                face_offsets = [
                    (0.5, 0.5, 0.0),  # 底面・上面
                    (0.5, 0.5, 1.0),
                    (0.5, 0.0, 0.5),  # 前面・後面
                    (0.5, 1.0, 0.5),
                    (0.0, 0.5, 0.5),  # 左面・右面
                    (1.0, 0.5, 0.5),
                ]
                for dx, dy, dz in face_offsets:
                    points.append([
                        ox + dx * LATTICE_SPACING,
                        oy + dy * LATTICE_SPACING,
                        oz + dz * LATTICE_SPACING,
                    ])

    return _unique_points(points)


def _unique_points(points, decimals=6):
    """同じ座標の点が重なったとき、1つにまとめる。"""
    if not points:
        return np.empty((0, 3))
    arr = np.array(points, dtype=float)
    rounded = np.round(arr, decimals=decimals)
    _, unique_idx = np.unique(rounded, axis=0, return_index=True)
    return arr[np.sort(unique_idx)]


def draw_unit_cell_wireframe(ax, cells_x, cells_y, cells_z, color="gray", alpha=0.35):
    """
    単位胞の枠線を薄く描く（格子点の位置関係が分かりやすくなる）。
    散布図だけでも要件は満たすが、高校生向けに補助線を追加している。
    """
    for i in range(cells_x):
        for j in range(cells_y):
            for k in range(cells_z):
                ox, oy, oz = i, j, k
                corners = [
                    (ox, oy, oz), (ox + 1, oy, oz), (ox + 1, oy + 1, oz), (ox, oy + 1, oz),
                    (ox, oy, oz + 1), (ox + 1, oy, oz + 1), (ox + 1, oy + 1, oz + 1), (ox, oy + 1, oz + 1),
                ]
                edges = [
                    (0, 1), (1, 2), (2, 3), (3, 0),
                    (4, 5), (5, 6), (6, 7), (7, 4),
                    (0, 4), (1, 5), (2, 6), (3, 7),
                ]
                for a, b in edges:
                    xs = [corners[a][0], corners[b][0]]
                    ys = [corners[a][1], corners[b][1]]
                    zs = [corners[a][2], corners[b][2]]
                    ax.plot(xs, ys, zs, color=color, alpha=alpha, linewidth=0.8)


def show_lattice_3d(points, title, lattice_name):
    """3D散布図で格子点を表示する。"""
    fig = plt.figure(figsize=(8, 7))
    ax = fig.add_subplot(111, projection="3d")

    # 格子点を球のように見える点で描く
    ax.scatter(
        points[:, 0], points[:, 1], points[:, 2],
        s=120, c="#06b6d4", edgecolors="#0e7490", linewidths=0.6, depthshade=True,
    )

    # 立方体の枠（位置の目安）
    draw_unit_cell_wireframe(ax, CELLS_X, CELLS_Y, CELLS_Z)

    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_zlabel("z")
    ax.set_title(title, fontsize=14, pad=16)

    # 3軸のスケールを同じにして、立方体が歪んで見えないようにする
    max_range = max(CELLS_X, CELLS_Y, CELLS_Z) + 1
    ax.set_xlim(0, max_range)
    ax.set_ylim(0, max_range)
    ax.set_zlim(0, max_range)
    ax.set_box_aspect((1, 1, 1))

    info = (
        f"{lattice_name}  |  格子点数: {len(points)}  |  "
        "マウスで回転・拡大できます（ウィンドウを閉じると終了）"
    )
    fig.text(0.5, 0.02, info, ha="center", fontsize=10, color="#334155")

    plt.tight_layout()
    plt.show()


def choose_lattice_type():
    """実行時に SC / BCC / FCC を選ぶ簡単なメニュー。"""
    print()
    print("=" * 52)
    print("  結晶格子 3D 可視化シミュレーション")
    print("=" * 52)
    print("  表示したい格子を選んでください。")
    print()
    print("    1 : SC  （単純立方格子）")
    print("    2 : BCC （体心立方格子）")
    print("    3 : FCC （面心立方格子）")
    print()

    while True:
        choice = input("  番号を入力 (1 / 2 / 3) > ").strip()
        if choice == "1":
            return "SC"
        if choice == "2":
            return "BCC"
        if choice == "3":
            return "FCC"
        print("  ※ 1、2、3 のいずれかを入力してください。")


def print_student_explanation():
    """高校生向け：このプログラムの説明を表示する。"""
    print()
    print("=" * 52)
    print("【このプログラムの説明 — 高校生向け】")
    print("=" * 52)
    print(
        """
  金属などの結晶は、原子が規則正しく並んだ「結晶格子」で
  表すことができます。このプログラムでは、代表的な3種類の
  立方系の格子を、コンピュータ上の3Dグラフで見ることができます。

  ■ SC（単純立方格子）
    立方体の「8つの頂点」だけに原子がある、もっとも単純な並び方です。

  ■ BCC（体心立方格子）
    立方体の8つの頂点に加えて、「立方体の真ん中」にも
    原子があります（体心）。鉄（α-Fe）などに近い型です。

  ■ FCC（面心立方格子）
    8つの頂点に加えて、「6つの面の中心」にも原子があります。
    銅（Cu）やアルミ（Al）など多くの金属がこの型です。

  グラフの青い点が格子点（原子の位置のイメージ）で、
  薄い灰色の線は単位胞（最小の立方体）の枠です。
  マウスで図を回転させると、立体の並び方が確認できます。

  化学や物理で「結晶構造」を学ぶとき、
  教科書のイラストを、実際に動かして確かめるための道具だと
  考えてください。
"""
    )
    print("=" * 52)
    print()


def main():
    lattice_type = choose_lattice_type()

    if lattice_type == "SC":
        points = generate_sc_lattice(CELLS_X, CELLS_Y, CELLS_Z)
        title = "SC（単純立方格子）— 頂点のみ"
        name = "SC（単純立方）"
    elif lattice_type == "BCC":
        points = generate_bcc_lattice(CELLS_X, CELLS_Y, CELLS_Z)
        title = "BCC（体心立方格子）— 頂点 + 体心"
        name = "BCC（体心立方）"
    else:
        points = generate_fcc_lattice(CELLS_X, CELLS_Y, CELLS_Z)
        title = "FCC（面心立方格子）— 頂点 + 各面の中心"
        name = "FCC（面心立方）"

    print(f"\n  → {name} を表示します（格子点 {len(points)} 個）\n")

    show_lattice_3d(points, title, name)

    # ウィンドウを閉じたあと、高校生向けの説明を表示
    print_student_explanation()


if __name__ == "__main__":
    main()
