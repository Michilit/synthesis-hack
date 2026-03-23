import React, { useState } from "react";
import type { Task } from "../types";

interface Props {
  tasks: Task[];
}

const DIFFICULTY_CONFIG = {
  easy: {
    label: "Easy",
    bg: "bg-green-900/50",
    text: "text-green-300",
    border: "border-green-800",
    header: "text-green-400",
  },
  medium: {
    label: "Medium",
    bg: "bg-yellow-900/50",
    text: "text-yellow-300",
    border: "border-yellow-800",
    header: "text-yellow-400",
  },
  hard: {
    label: "Hard",
    bg: "bg-orange-900/50",
    text: "text-orange-300",
    border: "border-orange-800",
    header: "text-orange-400",
  },
  expert: {
    label: "Expert",
    bg: "bg-red-900/50",
    text: "text-red-300",
    border: "border-red-800",
    header: "text-red-400",
  },
};

const DIFFICULTY_ORDER: Task["difficulty"][] = ["medium", "hard", "expert"];

export default function TaskBoard({ tasks }: Props) {
  const [claimedIds, setClaimedIds] = useState<Set<string>>(
    new Set(tasks.filter((t) => t.claimed).map((t) => t.id)),
  );

  function handleClaim(taskId: string) {
    setClaimedIds((prev) => new Set([...prev, taskId]));
  }

  const grouped = DIFFICULTY_ORDER.reduce<Record<string, Task[]>>(
    (acc, diff) => {
      acc[diff] = tasks.filter((t) => t.difficulty === diff);
      return acc;
    },
    {} as Record<string, Task[]>,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">
            Contribution Opportunities
          </h3>
          <p className="text-xs text-gray-500">
            Curated by Maintainer Agent · Earn reputation &amp; prestige — no
            cash rewards
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {tasks.filter((t) => !claimedIds.has(t.id)).length} open ·{" "}
          {claimedIds.size} claimed
        </div>
      </div>

      {DIFFICULTY_ORDER.map((difficulty) => {
        const group = grouped[difficulty];
        if (!group.length) return null;
        const cfg = DIFFICULTY_CONFIG[difficulty];

        return (
          <div key={difficulty}>
            <div className="flex items-center gap-3 mb-3">
              <h4
                className={`text-sm font-bold uppercase tracking-wide ${cfg.header}`}
              >
                {cfg.label}
              </h4>
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-xs text-gray-600">
                {group.length} tasks
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {group.map((task) => {
                const isClaimed = claimedIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    className={`bg-gray-900 border rounded-xl p-4 transition-opacity ${
                      cfg.border
                    } ${isClaimed ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h5 className="text-sm font-semibold text-white leading-snug">
                        {task.title}
                      </h5>
                      <span
                        className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 leading-relaxed mb-3">
                      {task.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 text-gray-400 text-xs font-mono border border-gray-700">
                          📦 {task.repo}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 text-xs font-bold border border-purple-800/50">
                          ⭐ Reputation XP
                        </span>
                      </div>

                      {isClaimed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-900/40 text-blue-300 text-xs font-medium border border-blue-800/50">
                          ⚙️ In Progress
                        </span>
                      ) : (
                        <button
                          onClick={() => handleClaim(taskId)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${cfg.bg} ${cfg.text} hover:brightness-125 border ${cfg.border}`}
                        >
                          Claim →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
