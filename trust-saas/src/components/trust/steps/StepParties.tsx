"use client";

import { useContractStore } from "@/lib/store/contractStore";
import { priorityRankLabel } from "@/lib/engine/calc";
import { PartyCard } from "./PartyCard";

export function StepParties() {
  const {
    form,
    addParty,
    setSameAsTrustor,
  } = useContractStore();

  return (
    <div>
      <h3 className="group-title">위탁자</h3>
      {form.trustors.map((p, i) => (
        <PartyCard
          key={i}
          role="trustors"
          idx={i}
          party={p}
          label="위탁자"
          removable={form.trustors.length > 1}
        />
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => addParty("trustors")}>
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
            />
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => addParty("debtors")}>
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
            />
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => addParty("beneficiaries")}>
            + 수익자 추가
          </button>
        </>
      )}
    </div>
  );
}

export function StepPriority() {
  const { form, addParty } = useContractStore();
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
        />
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => addParty("priorities")}>
        + 우선수익자 추가
      </button>
    </div>
  );
}
