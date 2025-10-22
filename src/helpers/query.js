// Reusable helpers for pagination and sorting across GET APIs
// Usage examples:
//  - Simple find():
//    const { page, limit, skip, sort } = getPagingParams(req.query, { sortBy: 'id' });
//    const total = await Model.countDocuments(filter);
//    const items = await Model.find(filter).sort(sort).skip(skip).limit(limit);
//    res.json({ data: items, meta: buildMeta(total, page, limit) });
//
//  - Aggregation pipeline:
//    const paging = getPagingParams(req.query, { sortBy: 'id' });
//    const data = await Model.aggregate([...pipeline, ...buildPipelineStages(paging)]);
//    // For total, run a parallel count pipeline or skip meta if not needed

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function parseNumber(val, fallback) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
}

// Parse sort from query: supports either `sort` (e.g. "name,-price") or `sortBy` + `sortOrder`
function parseSort(query, defaultSortBy = 'id', defaultSortOrder = 'asc') {
    const sort = {};
    if (typeof query.sort === 'string' && query.sort.trim().length) {
        for (const token of query.sort.split(',').map(s => s.trim()).filter(Boolean)) {
            if (token.startsWith('-')) sort[token.slice(1)] = -1; else sort[token] = 1;
        }
    } else {
        const sortBy = query.sortBy || defaultSortBy;
        const order = String(query.sortOrder || defaultSortOrder).toLowerCase();
        const dir = order === 'desc' || order === '-1' ? -1 : 1;
        if (sortBy) sort[sortBy] = dir;
    }
    return sort;
}

function getPagingParams(query, options = {}) {
    const { defaultPage = 1, defaultLimit = 10, maxLimit = 100, sortBy = 'id', sortOrder = 'asc' } = options;
    const page = clamp(parseNumber(query.page, defaultPage), 1, Number.MAX_SAFE_INTEGER);
    const limit = clamp(parseNumber(query.limit, defaultLimit), 1, maxLimit);
    const skip = (page - 1) * limit;
    const sort = parseSort(query, sortBy, sortOrder);
    return { page, limit, skip, sort };
}

function applyPagingAndSortingToQuery(mongooseQuery, paging) {
    const { sort, skip, limit } = paging;
    if (sort && Object.keys(sort).length) mongooseQuery = mongooseQuery.sort(sort);
    if (Number.isFinite(skip)) mongooseQuery = mongooseQuery.skip(skip);
    if (Number.isFinite(limit)) mongooseQuery = mongooseQuery.limit(limit);
    return mongooseQuery;
}

function buildPipelineStages(paging) {
    const stages = [];
    const { sort, skip, limit } = paging;
    if (sort && Object.keys(sort).length) stages.push({ $sort: sort });
    if (Number.isFinite(skip) && skip > 0) stages.push({ $skip: skip });
    if (Number.isFinite(limit)) stages.push({ $limit: limit });
    return stages;
}

function buildMeta(total, page, limit) {
    const totalPages = Math.max(1, Math.ceil((total || 0) / (limit || 1)));
    return { total, page, limit, totalPages };
}

// Build a case-insensitive $regex OR filter across fields from a query param (default: q)
function buildSearchFilter(queryObj, fields = [], paramName = 'q') {
    if (!fields.length) return {};
    const raw = queryObj?.[paramName];
    if (typeof raw !== 'string' || !raw.trim()) return {};
    const q = raw.trim();
    return {
        $or: fields.map(f => ({ [f]: { $regex: q, $options: 'i' } }))
    };
}

module.exports = {
    getPagingParams,
    applyPagingAndSortingToQuery,
    buildPipelineStages,
    buildMeta,
    buildSearchFilter,
};
