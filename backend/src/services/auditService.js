/**
 * Append-only audit trail (FR-25, NFR-09)
 * Owner: Sabbir (S-BE-8)
 */

export async function log(client, { actorId = null, action, entityType = null, entityId = null, details = {}, note = null }) {
  const { rows } = await client.query(
    `insert into audit_log (actor_id, action, entity_type, entity_id, details, note)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [actorId, action, entityType, entityId, JSON.stringify(details ?? {}), note]
  );
  return Number(rows[0].id);
}

export async function list(client, { limit = 50, before = null } = {}) {
  const { rows } = await client.query(
    `select a.id, a.actor_id, a.action, a.entity_type, a.entity_id, a.details, a.note, a.created_at,
            p.full_name as actor_name
       from audit_log a
       left join profiles p on p.id = a.actor_id
      where ($2::timestamptz is null or a.created_at < $2)
      order by a.created_at desc, a.id desc
      limit $1`,
    [Math.min(Number(limit) || 50, 200), before]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    actorId: row.actor_id,
    actor: row.actor_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: row.details,
    note: row.note,
    createdAt: row.created_at
  }));
}
