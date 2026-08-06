-- 고객 삭제 시 배정/큐 정리 훅 (2026-08-06, 후속 ③)
--
-- 배경: operator_client_assignments / djp_submission_queue 의 customer_id 에
-- FK 가 없어서, 고객 삭제 후에도 활성 배정(10건)과 큐 행(19건)이 고아로
-- 남아 있었다 (발행보드 고아 카드 bf738cab, 지시 이력 QA 400 이 같은 뿌리).
-- FK ON DELETE CASCADE 를 걸어 DB 레벨에서 원천 차단한다.
--
-- 참고: ai_usage_log / customer_complaints 의 customer_id 도 FK 가 없지만
-- 로그·이력 성격이라 손대지 않는다 (고아 행이 기능을 오염시키지 않음).

-- 1) 기존 고아 행 정리 — FK 추가 전 필수.
--    djp_submission_queue 자식들은 CASCADE('c')/SET NULL('n') 이라 함께 정리됨.
--    customer_complaints.queue_item_id 만 NO ACTION 이지만 현재 0행.
DELETE FROM operator_client_assignments a
WHERE NOT EXISTS (SELECT 1 FROM customer c WHERE c.id = a.customer_id);

DELETE FROM djp_submission_queue q
WHERE NOT EXISTS (SELECT 1 FROM customer c WHERE c.id = q.customer_id);

-- 2) FK ON DELETE CASCADE
ALTER TABLE operator_client_assignments
  ADD CONSTRAINT operator_client_assignments_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE;

ALTER TABLE djp_submission_queue
  ADD CONSTRAINT djp_submission_queue_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE;
