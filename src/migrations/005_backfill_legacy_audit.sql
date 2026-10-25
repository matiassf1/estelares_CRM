-- Repara la auditoría de los períodos creados por el backfill de 004.
-- Migración: 005_backfill_legacy_audit
--
-- El backfill de 004 inserta en membership_periods pero no escribía la entrada
-- correspondiente en audit_log, a diferencia de scripts/backfill-membership.js,
-- que sí lo hacía. Resultado: los jugadores migrados quedaban con un período
-- vigente y cero historial auditado.
--
-- Va acá y no corrigiendo 004 porque 004 ya se aplicó en producción y el runner
-- no lo reejecuta. Al correr después de 004, esta migración cubre tanto las
-- bases existentes como las instalaciones nuevas.
--
-- Idempotente: el NOT EXISTS evita duplicar si se reejecuta.

INSERT INTO audit_log (entity, entity_id, action, old_value, new_value,
                       performed_by, performed_by_type, reason, performed_at)
SELECT 'member',
       p.member_id,
       'legacy_migrated',
       jsonb_build_object('activo', false),
       jsonb_build_object('status', 'SUSPENDED', 'period_id', p.id, 'needs_review', true),
       p.created_by,
       'admin',
       p.reason,
       p.created_at
FROM membership_periods p
WHERE p.legacy_migrated = true
  AND NOT EXISTS (
    SELECT 1 FROM audit_log a
    WHERE a.entity = 'member'
      AND a.entity_id = p.member_id
      AND a.action = 'legacy_migrated'
  );
