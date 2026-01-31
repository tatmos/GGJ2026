# SPDX-License-Identifier: MIT
"""
Blender で街メッシュをブロック分割するスクリプト

使い方:
  1. 分割したいオブジェクトを選択
  2. Blender の「スクリプティング」ワークスペースでこのファイルを開く
  3. 先頭の BLOCK_SIZE_X, BLOCK_SIZE_Y を好みに変更（メートル単位・BlenderはZ-upなので地面はXY平面）
  4. スクリプトを実行（▶ または Alt+P）
  5. 同じコレクションに Block_0_0, Block_0_1, ... が作成されます

※ 実行後、元のオブジェクトは削除されます（残したい場合は DELETE_ORIGINAL = False に変更）
"""

import bpy

# ========== ここを編集 ==========
BLOCK_SIZE_X = 50.0   # X方向のブロック幅（メートル）
BLOCK_SIZE_Y = 50.0   # Y方向のブロック幅（メートル・BlenderはZ-upなので地面はXY平面）
DELETE_ORIGINAL = True  # 実行後に元オブジェクトを削除するか
# ================================


def get_world_bounds(obj):
    """オブジェクトのワールド空間でのAABBを (min_x, min_y, min_z, max_x, max_y, max_z) で返す"""
    world = obj.matrix_world
    mesh = obj.data
    if not mesh.vertices:
        return None
    vs = [world @ v.co for v in mesh.vertices]
    xs = [v.x for v in vs]
    ys = [v.y for v in vs]
    zs = [v.z for v in vs]
    return (min(xs), min(ys), min(zs), max(xs), max(ys), max(zs))


def face_world_center(obj, face):
    """面のワールド空間での中心を返す"""
    world = obj.matrix_world
    mesh = obj.data
    verts = mesh.vertices
    n = len(face.vertices)
    cx = cy = cz = 0.0
    for vi in face.vertices:
        v = world @ verts[vi].co
        cx += v.x
        cy += v.y
        cz += v.z
    return (cx / n, cy / n, cz / n)


def split_mesh_into_blocks(obj, block_size_x, block_size_y):
    """
    メッシュをグリッドブロックごとにグループ化する。
    BlenderはZ-upなので地面はXY平面。X・Yでブロックを区切る。
    返り値: dict[(ix, iy)] -> set of face indices
    """
    bounds = get_world_bounds(obj)
    if bounds is None:
        return {}
    min_x, min_y, min_z, max_x, max_y, max_z = bounds
    world = obj.matrix_world
    mesh = obj.data
    cells = {}  # (ix, iy) -> set(face_index)

    for fi, face in enumerate(mesh.polygons):
        cx, cy, cz = face_world_center(obj, face)
        ix = int((cx - min_x) / block_size_x)
        iy = int((cy - min_y) / block_size_y)
        key = (ix, iy)
        if key not in cells:
            cells[key] = set()
        cells[key].add(fi)

    return cells


def create_block_mesh(obj, face_indices):
    """
    指定した面インデックスだけを含む新しいメッシュを作成する。
    頂点はローカル座標のまま（オブジェクトの matrix_world で位置は保たれる）。
    返り値: (verts_local, faces)  faces は新しい頂点インデックスのリストのリスト
    """
    mesh = obj.data
    used_verts = set()
    for fi in face_indices:
        for vi in mesh.polygons[fi].vertices:
            used_verts.add(vi)

    old_to_new = {}
    verts_local = []
    for i, vi in enumerate(sorted(used_verts)):
        old_to_new[vi] = i
        verts_local.append(mesh.vertices[vi].co.copy())

    faces = []
    for fi in face_indices:
        poly = mesh.polygons[fi]
        new_face = [old_to_new[vi] for vi in poly.vertices]
        faces.append(new_face)

    return verts_local, faces


def create_mesh_from_verts_faces(verts_local, faces, name):
    """頂点リストと面リストから Blender メッシュを作成"""
    mesh = bpy.data.meshes.new(name=name)
    mesh.from_pydata(verts_local, [], faces)
    mesh.update()
    return mesh


def main():
    if not bpy.context.selected_objects:
        print("エラー: オブジェクトを選択してください。")
        return

    for obj in bpy.context.selected_objects:
        if obj.type != "MESH":
            print(f"スキップ: {obj.name} はメッシュではありません。")
            continue

        mesh = obj.data
        if len(mesh.polygons) == 0:
            print(f"スキップ: {obj.name} に面がありません。")
            continue

        cells = split_mesh_into_blocks(obj, BLOCK_SIZE_X, BLOCK_SIZE_Y)
        if not cells:
            print(f"スキップ: {obj.name} からブロックを計算できませんでした。")
            continue

        collection = obj.users_collection[0] if obj.users_collection else bpy.context.scene.collection
        world_matrix = obj.matrix_world.copy()

        created = []
        for (ix, iy), face_indices in sorted(cells.items()):
            verts_local, faces = create_block_mesh(obj, list(face_indices))
            if not verts_local or not faces:
                continue
            block_name = f"Block_{ix}_{iy}"
            new_mesh = create_mesh_from_verts_faces(verts_local, faces, block_name)
            new_obj = bpy.data.objects.new(block_name, new_mesh)
            new_obj.matrix_world = world_matrix
            collection.objects.link(new_obj)
            created.append(new_obj)

        print(f"{obj.name} → {len(created)} ブロックに分割しました。")

        if DELETE_ORIGINAL and created:
            bpy.data.objects.remove(obj, do_unlink=True)

    print("完了。")


if __name__ == "__main__":
    main()
