"use client";

import { Fragment } from "react";
import { useContractStore } from "@/lib/store/contractStore";
import { priorityRankLabel, samePartyReason, trustorRankLabel } from "@/lib/engine/calc";
import { useFocusAfterRemove } from "@/lib/ui/use-focus-after-remove";
import { PartyCard } from "./PartyCard";

export function StepParties() {
  const {
    form,
    addParty,
    setSameAsTrustor,
  } = useContractStore();

  // 카드 삭제 버튼 후 포커스를 같은 그룹 "+ 추가" 버튼으로 이동(WCAG 2.4.3, 그룹별 1개씩)
  const trustorFocus = useFocusAfterRemove(form.trustors.length);
  const debtorFocus = useFocusAfterRemove(form.debtors.length);
  const beneFocus = useFocusAfterRemove(form.beneficiaries.length);

  return (
    <div>
      <h3 className="group-title">위탁자</h3>
      {form.trustors.length > 1 && (
        <p className="field-hint" style={{ marginBottom: 14 }}>
          맨 위 위탁자가 <strong>대표위탁자</strong>입니다 — 위탁자 전원을 대리하여
          신탁해지를 포함한 권한을 행사합니다(별첨4 신탁특약). ▲▼ 로 순서를 바꿔 대표위탁자를 지정하세요.
        </p>
      )}
      {form.trustors.map((p, i) => (
        <PartyCard
          key={i}
          role="trustors"
          idx={i}
          party={p}
          label="위탁자"
          removable={form.trustors.length > 1}
          orderable
          count={form.trustors.length}
          rankNote={form.trustors.length > 1 ? trustorRankLabel(i) || undefined : undefined}
          orderNoun="순서"
          moveUpHint="대표위탁자 쪽으로"
          moveDownHint="뒤로"
          afterRemove={trustorFocus.markRemoved}
        />
      ))}
      <button ref={trustorFocus.addBtnRef} type="button" className="btn btn-ghost btn-sm party-add-btn" onClick={() => addParty("trustors")}>
        + 위탁자 추가
      </button>

      <h3 className="group-title" style={{ marginTop: 28 }}>
        채무자
        <label className="inline-check">
          <input
            type="checkbox"
            checked={form.debtorSameAsTrustor}
            onChange={(e) => setSameAsTrustor("debtor", e.target.checked)}
          />
          위탁자와 동일
        </label>
      </h3>
      {!form.debtorSameAsTrustor && (
        <>
          {form.debtors.map((p, i) => (
            <PartyCard
              key={i}
              role="debtors"
              idx={i}
              party={p}
              label="채무자"
              removable={form.debtors.length > 1}
              afterRemove={debtorFocus.markRemoved}
            />
          ))}
          <button ref={debtorFocus.addBtnRef} type="button" className="btn btn-ghost btn-sm party-add-btn" onClick={() => addParty("debtors")}>
            + 채무자 추가
          </button>
        </>
      )}

      <h3 className="group-title" style={{ marginTop: 28 }}>
        수익자
        <label className="inline-check">
          <input
            type="checkbox"
            checked={form.beneficiarySameAsTrustor}
            onChange={(e) => setSameAsTrustor("beneficiary", e.target.checked)}
          />
          위탁자와 동일
        </label>
      </h3>
      {!form.beneficiarySameAsTrustor && (
        <>
          {form.beneficiaries.map((p, i) => (
            <PartyCard
              key={i}
              role="beneficiaries"
              idx={i}
              party={p}
              label="수익자"
              removable={form.beneficiaries.length > 1}
              afterRemove={beneFocus.markRemoved}
            />
          ))}
          <button ref={beneFocus.addBtnRef} type="button" className="btn btn-ghost btn-sm party-add-btn" onClick={() => addParty("beneficiaries")}>
            + 수익자 추가
          </button>
        </>
      )}
    </div>
  );
}

export function StepPriority() {
  const { form, addParty } = useContractStore();
  const prioFocus = useFocusAfterRemove(form.priorities.length);
  return (
    <div>
      <h3 className="group-title">우선수익자 (금융기관 등)</h3>
      <p className="field-hint" style={{ marginBottom: 14 }}>
        카드의 표시 순서가 곧 <strong>법적 우선순위</strong>입니다 — 위에 있을수록 선순위입니다.
        최선순위 우선수익자의 의사가 의사결정을 좌우하고(본문 제3조), 환가·정산도 이 순서를 따릅니다(제22조).
        ▲▼ 로 순서를 바꿔 선·후순위를 조정하세요.
      </p>
      {form.priorities.map((p, i) => {
        // 입력 지점 구조 정합 교차검증(표시 전용·게이트 아님) — 담보신탁에서 위탁자(담보제공자)와
        // 우선수익자(채권자)는 구조적으로 반대편 당사자라 동일 주체일 수 없는데, 두 목록이 서로 다른
        // 단계(STEP 02 관계사 vs 02-1 우선수익자)에서 입력돼 같은 회사를 양쪽에 잘못 넣어도 짚을 신호가
        // 없었다. 이 우선수익자가 어느 위탁자와 같은 식별자(사업자번호·법인등록번호, 없으면 이름)를
        // 가지면 부드럽게 되짚는다(StepLoanCalc 한도합계 vs 평가가격·StepBasic 보수율 advisory 와 동형의
        // "막지 않는 되짚음"). samePartyReason 은 이미 입력된 두 당사자의 순수 비교일 뿐 새 상태/모델/
        // 엔진/조문 무접촉이고, 식별자가 양쪽 다 완비돼 다르면(다른 주체 확정) 이름이 같아도 미표출한다.
        const trustorMatch = form.trustors
          .map((t) => ({ t, reason: samePartyReason(p, t) }))
          .find((m) => m.reason !== null);
        // 입력 지점 구조 정합 교차검증(표시 전용·게이트 아님) — 우선수익자(채권자)는 피담보채권을
        // 가진 자, 채무자는 그 채무를 지는 자라 동일 주체일 수 없다(같은 당사자면 피담보채권이 혼동으로
        // 소멸해 담보 구조 불성립). 채무자를 위탁자와 다르게 별도 입력(debtorSameAsTrustor=false)하면
        // STEP 01 채무자 목록과 STEP 02-1 우선수익자가 서로 다른 단계에서 입력돼, 같은 회사를 양쪽에
        // 잘못 넣어도 짚을 신호가 없었다. 위 위탁자 교차검증과 동형으로 부드럽게 되짚는다. 채무자=위탁자
        // (동일)인 경우는 위 trustorMatch 가 이미 같은 충돌을 덮으므로 별도 입력 시에만 본다(중복 회피).
        const debtorMatch = form.debtorSameAsTrustor
          ? undefined
          : form.debtors
              .map((d) => ({ d, reason: samePartyReason(p, d) }))
              .find((m) => m.reason !== null);
        return (
          <Fragment key={i}>
            <PartyCard
              role="priorities"
              idx={i}
              party={p}
              label="우선수익자"
              showLoanFields
              removable={form.priorities.length > 1}
              orderable
              count={form.priorities.length}
              rankNote={i === 0 ? `${priorityRankLabel(i)} · 최선순위` : priorityRankLabel(i)}
              afterRemove={prioFocus.markRemoved}
            />
            {trustorMatch && (
              <div
                className="field-hint"
                role="status"
                aria-live="polite"
                style={{ marginTop: -8, marginBottom: 14, color: "var(--c-brown)", fontWeight: 600 }}
              >
                <span aria-hidden="true">⚠ </span>
                이 우선수익자가 위탁자
                {trustorMatch.t.name ? `(${trustorMatch.t.name})` : ""}와 같은 {trustorMatch.reason}입니다 —
                담보신탁에서 위탁자(담보제공자)와 우선수익자(채권자)는 통상 다른 당사자입니다. 확인하세요.
              </div>
            )}
            {debtorMatch && (
              <div
                className="field-hint"
                role="status"
                aria-live="polite"
                style={{ marginTop: -8, marginBottom: 14, color: "var(--c-brown)", fontWeight: 600 }}
              >
                <span aria-hidden="true">⚠ </span>
                이 우선수익자가 채무자
                {debtorMatch.d.name ? `(${debtorMatch.d.name})` : ""}와 같은 {debtorMatch.reason}입니다 —
                채무자(피담보채무를 지는 자)와 우선수익자(채권자)는 통상 다른 당사자입니다. 확인하세요.
              </div>
            )}
          </Fragment>
        );
      })}
      <button ref={prioFocus.addBtnRef} type="button" className="btn btn-ghost btn-sm party-add-btn" onClick={() => addParty("priorities")}>
        + 우선수익자 추가
      </button>
    </div>
  );
}
