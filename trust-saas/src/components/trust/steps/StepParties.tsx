"use client";

import { useContractStore } from "@/lib/store/contractStore";
import { priorityRankLabel, trustorRankLabel } from "@/lib/engine/calc";
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
      {form.priorities.map((p, i) => (
        <PartyCard
          key={i}
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
      ))}
      <button ref={prioFocus.addBtnRef} type="button" className="btn btn-ghost btn-sm party-add-btn" onClick={() => addParty("priorities")}>
        + 우선수익자 추가
      </button>
    </div>
  );
}
