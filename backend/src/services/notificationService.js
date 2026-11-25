/**
 * In-app notifications (FR-32, FR-33)
 * Owner: Sabbir (S-BE-8)
 * One re-plan produces at most one message per student per type (grouped).
 */

function mapRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    data: row.data,
    read: row.read,
    createdAt: row.created_at
  };
}

export async function notifyGrouped(client, entries = []) {
  const grouped = new Map();
  for (const entry of entries) {
    if (!entry?.userId) continue;
    const key = `${entry.userId}:${entry.type}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        userId: entry.userId,
        type: entry.type,
        messages: [entry.message],
        data: [entry.data ?? {}]
      });
    } else {
      if (!existing.messages.includes(entry.message)) existing.messages.push(entry.message);
      existing.data.push(entry.data ?? {});
    }
  }

  const created = [];
  for (const item of grouped.values()) {
    const { rows } = await client.query(
      `insert into notifications (user_id, type, message, data)
       values ($1, $2, $3, $4)
       returning *`,
      [item.userId, item.type, item.messages.join(' '), JSON.stringify({ items: item.data })]
    );
    created.push(mapRow(rows[0]));
  }
  return created;
}

export async function notifyAdmins(client, { type, message, data = {} }) {
  const { rows: admins } = await client.query(
    "select id from profiles where role = 'admin' and active"
  );
  return notifyGrouped(
    client,
    admins.map((admin) => ({ userId: admin.id, type, message, data }))
  );
}

export async function listFor(client, userId, { unread = false } = {}) {
  const { rows } = await client.query(
    `select * from notifications
      where user_id = $1 and ($2::boolean is false or read = false)
      order by created_at desc`,
    [userId, Boolean(unread)]
  );
  return rows.map(mapRow);
}

export async function markRead(client, notificationId, userId) {
  const { rows } = await client.query(
    `update notifications set read = true
      where id = $1 and user_id = $2
      returning *`,
    [notificationId, userId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function markAllRead(client, userId) {
  await client.query('update notifications set read = true where user_id = $1 and read = false', [userId]);
  return { success: true };
}

export async function unreadCount(client, userId) {
  const { rows } = await client.query(
    'select count(*)::int as count from notifications where user_id = $1 and read = false',
    [userId]
  );
  return rows[0]?.count ?? 0;
}
