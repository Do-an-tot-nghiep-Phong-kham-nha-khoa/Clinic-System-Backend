const Role = require('../models/role');

// [GET] /admin/roles
module.exports.index = async (req, res) => {
  try {
    const roles = await Role.find({ deleted: false }).sort({ createdAt: -1 });
    return res.status(200).json({
      titlePage: "Danh sách nhóm quyền",
      roles,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi khi lấy danh sách roles", error });
  }
};

// [POST] /admin/roles
module.exports.create = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    // Kiểm tra trùng tên
    const existing = await Role.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: "Tên role đã tồn tại" });
    }

    const newRole = new Role({
      name,
      description,
      permissions: permissions || [],
    });

    await newRole.save();

    return res.status(201).json({
      message: "Tạo role thành công",
      role: newRole,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi khi tạo role", error });
  }
};

// [PATCH] /admin/roles/:id
module.exports.editRoles = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description, permissions } = req.body;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: "Không tìm thấy role" });
    }

    if (name) role.name = name;
    if (description) role.description = description;
    if (permissions) role.permissions = permissions;

    await role.save();

    return res.status(200).json({ message: "Cập nhật role thành công", role });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi khi cập nhật role", error });
  }
};

// [PATCH] /admin/roles/:id/permissions
module.exports.editPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: "Không tìm thấy role" });
    }

    role.permissions = permissions;
    await role.save();

    return res.status(200).json({ message: "Cập nhật quyền thành công", role });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi khi cập nhật quyền", error });
  }
};

// [DELETE] /admin/roles/:id
module.exports.delete = async (req, res) => {
  try {
    const id = req.params.id;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: "Không tìm thấy role" });
    }

    role.deleted = true;
    role.deletedAt = new Date();
    await role.save();

    return res.status(200).json({ message: "Xóa role thành công" });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi khi xóa role", error });
  }
};

// [GET] /admin/roles/:id
module.exports.detail = async (req, res) => {
  try {
    const id = req.params.id;
    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({ message: "Không tìm thấy role" });
    }

    return res.status(200).json({
      titlePage: `Chi tiết nhóm quyền: ${role.name}`,
      role,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi khi lấy chi tiết role", error });
  }
};
