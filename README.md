# retro（復盤）

你在對話裡糾正 Claude（指出錯誤、取消先前做法、宣告日後一律如何）時，這些教訓若沒寫進記憶或規則檔，下個 session 會重犯。retro 偵測到糾正就**主動提議**復盤，產出擬固定的教訓讓你**逐項核准**，核准的才交給主對話寫入。**Mod 本身不寫任何檔**，寫入照常經過 session 的權限設定與專案規則。

## 安裝

在 Claude Code 裡貼上這段話：

> 請幫我安裝 https://github.com/SynchronicEros/claude-code-mods-zh 裡的 retro（照該 README「給協助安裝的 AI」一節），遇到問題幫我處理，裝好告訴我怎麼讓它生效。

要更新時說「請幫我把 retro 更新到最新版」。

<details>
<summary>給協助安裝的 AI</summary>

- 需要 Claude Code（付費方案）；只有 Codex 的使用者無法安裝。
- 安裝（user scope，在終端機或 Bash 工具執行）：`claude plugin marketplace add SynchronicEros/claude-code-mods-zh`，再 `claude plugin install retro@claude-code-mods-zh`。
- 更新：`claude plugin marketplace update claude-code-mods-zh`，再 `claude plugin update retro@claude-code-mods-zh`；顯示 already at the latest version 即為最新。
- 一律保留總目錄那份；若同時裝了 `retro@claude-code-retro-zh`，執行 `claude plugin uninstall retro@claude-code-retro-zh`。
- 安裝或更新後須開新的 session 才生效（終端機版 `/exit` 後重打 `claude`；桌面版開新對話）。桌面版 Code 分頁不能用 `/plugin` 指令。
- 需要 Claude Code v2.1.287 以上（`claude --version` 查詢，太舊執行 `claude update`）。

</details>

## 流程

1. 你送出疑似糾正的話 → 關鍵詞初篩命中後，以小模型（預設 haiku）確認。
2. 回合結束後，輸入框上方出現「偵測到你在糾正 Claude：…［復盤］［略過］［本 session 不再問］」。
3. 按［復盤］→ 右側面板列出至多 5 項建議（目標檔、變更、理由、預覽原文），逐項［核准］。
4. 按［交出已核准項目］→ 以【復盤】開頭的訊息放進輸入框，你確認後按 Enter；輸入框有草稿時不覆蓋，會請你先清空。

## 細節

- 只偵測你本人送出的訊息（排除其他 plugin、背景任務、其他 session 來訊）；【復盤】開頭的交出訊息不會再被偵測。
- 已有記錄卻又重犯的教訓，提為「補強既有檔」，並要求主對話保留檔案其餘內容。
- 復盤分析失敗時，改以你的糾正原文列成一項草稿；交出時要求主對話**先回報要寫哪個檔、等你確認才寫**。
- 預覽以純文字顯示原文，交出前移除 HTML 註解等看不見的內容（所見即所交）。
- 寫入目標可疑（`.ssh`、含 `..`、專案與 `~/.claude` 以外之絕對路徑）時加黃字警示。
- 同一 session 連續按［略過］達設定次數後，本 session 不再提議。

## 設定（userConfig）

| 設定 | 預設 | 作用 |
|---|---|---|
| `classifierModel` | `haiku` | 確認是否為糾正的模型 |
| `maxSkips` | `2` | 連續略過幾次後靜音（須填 1 以上整數；填文字會使本 Mod 無法載入） |
| `forbiddenTargets` | （空） | 以逗號分隔；寫入目標含其中任一字樣（不分大小寫）即整項丟棄，例如 `secrets,private_notes` |

## 額度

初篩未命中不呼叫模型；命中時小模型確認一次；按［復盤］時分身一次（共用 prompt cache）。

## 授權

MIT（見 [LICENSE](LICENSE)）。

---

**English:** When you correct Claude, retro offers a retrospective above the prompt. Accepting forks the session for up to five lasting lessons, shown in a pane for item-by-item approval; approved items go back to the main thread as your draft (starting with 【復盤】), so writing stays under the session's own permissions and rules — the mod writes nothing itself. Options: `classifierModel` (default `haiku`), `maxSkips` (default 2), `forbiddenTargets` (comma-separated substrings; matching targets are dropped). The keyword pre-filter is tuned for Chinese.

**Install / License (English):** Requires Claude Code (a paid plan). Ask Claude Code to install `retro` from https://github.com/SynchronicEros/claude-code-mods-zh, or run `claude plugin marketplace add SynchronicEros/claude-code-mods-zh`, then `claude plugin install retro@claude-code-mods-zh`; takes effect in new sessions. MIT.
