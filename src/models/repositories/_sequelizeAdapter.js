const { Op } = require("sequelize");

function mapFieldName(field) {
  if (field === "_id") return "id";
  return field;
}

function mapProjection(projection) {
  if (!projection || typeof projection !== "object") return undefined;

  const attrs = Object.entries(projection)
    .filter(([, include]) => Boolean(include))
    .map(([field]) => mapFieldName(field))
    .filter((field, index, arr) => field && arr.indexOf(field) === index);

  if (attrs.length === 0) return undefined;
  if (!attrs.includes("id")) attrs.push("id");
  return attrs;
}

function mapOperatorObject(operatorObject) {
  const mapped = {};

  for (const [op, value] of Object.entries(operatorObject)) {
    if (op === "$in") {
      mapped[Op.in] = value;
      continue;
    }
    if (op === "$gte") {
      mapped[Op.gte] = value;
      continue;
    }
    if (op === "$lte") {
      mapped[Op.lte] = value;
      continue;
    }
    if (op === "$gt") {
      mapped[Op.gt] = value;
      continue;
    }
    if (op === "$lt") {
      mapped[Op.lt] = value;
      continue;
    }
    if (op === "$ne") {
      mapped[Op.ne] = value;
      continue;
    }
    if (op === "$exists") {
      mapped[value ? Op.not : Op.is] = null;
      continue;
    }
  }

  return mapped;
}

function mapWhere(where = {}) {
  if (!where || typeof where !== "object") return {};

  const mappedWhere = {};

  for (const [rawKey, rawValue] of Object.entries(where)) {
    if (rawKey === "$or" && Array.isArray(rawValue)) {
      mappedWhere[Op.or] = rawValue.map((clause) => mapWhere(clause));
      continue;
    }

    const key = mapFieldName(rawKey);
    const isOperatorObject =
      rawValue &&
      typeof rawValue === "object" &&
      !Array.isArray(rawValue) &&
      !(rawValue instanceof Date);

    mappedWhere[key] = isOperatorObject ? mapOperatorObject(rawValue) : rawValue;
  }

  return mappedWhere;
}

function normalizeUpdate(update = {}) {
  if (update && typeof update === "object" && update.$set) {
    return update.$set;
  }
  return update || {};
}

function wrapPlainObject(plain) {
  if (!plain || typeof plain !== "object") return plain;

  if (plain.id !== undefined && plain._id === undefined) {
    plain._id = plain.id;
  }

  return plain;
}

function wrapInstance(instance) {
  if (!instance) return null;

  if (!Object.getOwnPropertyDescriptor(instance, "_id")) {
    Object.defineProperty(instance, "_id", {
      get() {
        return this.getDataValue("id");
      },
      set(value) {
        this.setDataValue("id", value);
      },
      configurable: true,
      enumerable: false
    });
  }

  if (typeof instance.toObject !== "function") {
    instance.toObject = function toObject() {
      return wrapPlainObject(this.get({ plain: true }));
    };
  }

  return instance;
}

class SequelizeQueryAdapter {
  constructor(model, mode, { filter = {}, projection, id } = {}) {
    this.model = model;
    this.mode = mode;
    this.filter = filter;
    this.projection = projection;
    this.id = id;
    this.useLean = false;
    this.sortFields = [];
    this.limitCount = null;
  }

  sort(sortObj) {
    if (!sortObj || typeof sortObj !== "object") return this;

    this.sortFields = Object.entries(sortObj).map(([field, direction]) => [
      mapFieldName(field),
      Number(direction) === -1 ? "DESC" : "ASC"
    ]);
    return this;
  }

  limit(count) {
    this.limitCount = Number.isInteger(count) ? count : null;
    return this;
  }

  lean() {
    this.useLean = true;
    return this;
  }

  _finalizeSingle(instance) {
    if (!instance) return null;
    if (this.useLean) return wrapPlainObject(instance.get({ plain: true }));
    return wrapInstance(instance);
  }

  _finalizeMany(instances) {
    if (this.useLean) {
      return instances.map((instance) => wrapPlainObject(instance.get({ plain: true })));
    }
    return instances.map((instance) => wrapInstance(instance));
  }

  async exec() {
    const attributes = mapProjection(this.projection);

    if (this.mode === "findById") {
      const instance = await this.model.findByPk(this.id, { attributes });
      return this._finalizeSingle(instance);
    }

    if (this.mode === "findOne") {
      const instance = await this.model.findOne({
        where: mapWhere(this.filter),
        attributes,
        order: this.sortFields.length ? this.sortFields : undefined
      });
      return this._finalizeSingle(instance);
    }

    const instances = await this.model.findAll({
      where: mapWhere(this.filter),
      attributes,
      order: this.sortFields.length ? this.sortFields : undefined,
      limit: this.limitCount || undefined
    });
    return this._finalizeMany(instances);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }

  finally(cb) {
    return this.exec().finally(cb);
  }
}

function createModelAdapter(model) {
  return {
    create(doc) {
      if (Array.isArray(doc)) {
        return model
          .bulkCreate(doc, { returning: true })
          .then((rows) => rows.map((row) => wrapInstance(row)));
      }
      return model.create(doc).then((row) => wrapInstance(row));
    },

    find(filter = {}, projection) {
      return new SequelizeQueryAdapter(model, "find", { filter, projection });
    },

    findOne(filter = {}, projection) {
      return new SequelizeQueryAdapter(model, "findOne", { filter, projection });
    },

    findById(id, projection) {
      return new SequelizeQueryAdapter(model, "findById", { id, projection });
    },

    async findByIdAndUpdate(id, update) {
      await model.update(normalizeUpdate(update), { where: { id } });
      const updated = await model.findByPk(id);
      return wrapInstance(updated);
    },

    async updateOne(filter, update) {
      const [updatedCount] = await model.update(normalizeUpdate(update), {
        where: mapWhere(filter || {})
      });
      return { modifiedCount: updatedCount };
    },

    async updateMany(filter, update) {
      const [updatedCount] = await model.update(normalizeUpdate(update), {
        where: mapWhere(filter || {})
      });
      return { modifiedCount: updatedCount };
    },

    async deleteOne(filter) {
      const deletedCount = await model.destroy({
        where: mapWhere(filter || {}),
        limit: 1
      });
      return { deletedCount };
    },

    async deleteMany(filter = {}) {
      const deletedCount = await model.destroy({
        where: mapWhere(filter || {})
      });
      return { deletedCount };
    },

    async countDocuments(filter = {}) {
      return model.count({
        where: mapWhere(filter || {})
      });
    },

    async exists(filter = {}) {
      const row = await model.findOne({
        where: mapWhere(filter || {}),
        attributes: ["id"]
      });
      if (!row) return null;
      return { _id: row.id };
    }
  };
}

module.exports = {
  createModelAdapter,
  mapWhere,
  normalizeUpdate,
  wrapInstance,
  wrapPlainObject
};
