// -----------------------
// グローバル状態管理
// -----------------------
let currentBattery = 100;
let initialBattery = 100; // ゲーム開始時のバッテリー（記録用）
let activeNotifications = [];
let spawnIntervalId = null;
let notificationIdCounter = 1;
let isClockStarted = false; // 時計の二重起動防止用
let clearedNotificationsCount = 0; // 処理した通知の累積カウント
let savedUserName = ""; // ユーザー名
let targetClearCount = 10; // クリアに必要な通知処理数（デフォルト10件：ノーマル）
let gameStartTime = 0; // ゲーム開始時刻（勤務時間の計測用）
let comboCount = 0; // 連続コンボ数
let lastClearedTime = 0; // 直近で通知を処理した時刻
let comboTimerId = null; // コンボ表示タイマー管理用

// ランキング用状態
let currentRankingDifficulty = "10"; // モーダルで表示中の難易度タグ
let lastGameResult = null; // スコア送信用の最終リザルト情報
let isScoreSubmitted = false; // 今回のスコアが送信済みかどうかのフラグ
let toastTimeoutId = null; // トースト通知のタイマー管理用

// -----------------------
// 画面制御ロジック
// -----------------------
function startGame() {
    // 画面切り替え
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('clear-screen').classList.add('hidden');
    
    // リザルト演出のリセット
    document.querySelector('.phone-frame').classList.remove('clear-bg');
    
    // 難易度（通知ノルマ）の選択状態を確実に反映
    changeDifficulty();
    
    // ゲーム状態のリセット
    activeNotifications = [];
    notificationIdCounter = 1;
    clearedNotificationsCount = 0;
    comboCount = 0;
    lastClearedTime = 0;
    gameStartTime = Date.now(); // 勤務時間の計測開始時刻を記録
    document.getElementById('notification-container').innerHTML = '';
    
    updateCarrierDisplay(); // キャリア表示リセット
    init(); // ゲームの初期化処理を開始
}

// 設定画面（スマホの設定アプリ風）の開閉
function showSettings() {
    updateSettingsUsernameDisplay();
    document.getElementById('settings-screen').classList.remove('hidden');
    document.getElementById('settings-main-view').classList.remove('hidden');
    document.getElementById('settings-detail-view').classList.add('hidden');
}

function hideSettings() {
    document.getElementById('settings-screen').classList.add('hidden');
}

// 設定詳細サブ画面の切り替え
function openSettingDetail(type) {
    document.getElementById('settings-main-view').classList.add('hidden');
    const detailView = document.getElementById('settings-detail-view');
    detailView.classList.remove('hidden');

    const titleEl = document.getElementById('setting-detail-title');
    const contentEl = document.getElementById('setting-detail-content');
    contentEl.innerHTML = '';

    if (type === 'username') {
        titleEl.textContent = 'ユーザー名設定';
        contentEl.innerHTML = `
            <div class="p-3 bg-[#1c1c1e] rounded-2xl border border-white/5 space-y-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <div>
                        <div class="font-bold text-sm text-white">ユーザー名を設定</div>
                        <div class="text-[11px] text-gray-400">10文字以内で事前に設定可能です。プレイ中に自分宛ての通知が届くようになり、リザルト画面での変更も可能です。</div>
                    </div>
                </div>
                <div class="flex gap-2 pt-1">
                    <input type="text" id="username-input" maxlength="10" value="${escapeHtml(savedUserName)}" placeholder="ユーザー名を入力" class="flex-1 bg-black/60 border border-gray-600 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-400">
                    <button onclick="saveUsernameFromSettings()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-colors text-white shadow">保存</button>
                </div>
                <p id="username-msg" class="text-[11px] text-green-400 hidden text-center font-medium">保存しました！</p>
            </div>
        `;
    } else if (type === 'howto') {
        titleEl.textContent = '操作方法';
        contentEl.innerHTML = `
            <div class="p-3.5 bg-[#1c1c1e] rounded-2xl border border-white/5 space-y-3">
                <div class="font-bold text-white text-sm">基本操作</div>
                <p>届いた通知をタップして対応を選択するか、左右にスワイプして直感的に処理できます。</p>
                <div class="grid grid-cols-2 gap-2 pt-1">
                    <div class="p-2.5 bg-blue-950/40 border border-blue-500/30 rounded-xl">
                        <div class="font-bold text-blue-300 mb-1"><i class="fa-solid fa-arrow-left"></i> 左スワイプ</div>
                        <div class="text-[11px] text-gray-300">模範対応（安全ですが業務負担が増えることも）</div>
                    </div>
                    <div class="p-2.5 bg-red-950/40 border border-red-500/30 rounded-xl">
                        <div class="font-bold text-red-300 mb-1"><i class="fa-solid fa-arrow-right"></i> 右スワイプ</div>
                        <div class="text-[11px] text-gray-300">反抗対応（ダメージを受けるリスクあり）</div>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'system') {
        titleEl.textContent = 'ゲームシステム';
        contentEl.innerHTML = `
            <div class="p-3.5 bg-[#1c1c1e] rounded-2xl border border-white/5 space-y-3">
                <div class="font-bold text-white text-sm">クリア条件</div>
                <p>設定した通知ノルマ以上の通知を処理し、画面上の通知を0件にすることです。</p>
                <div class="border-t border-white/10 pt-2 font-bold text-white text-sm">ゲームオーバー条件</div>
                <ul class="list-disc list-inside space-y-1 text-gray-300 text-[11px]">
                    <li><strong>電源切れ：</strong>バッテリー残量が0%になる</li>
                    <li><strong>処理落ち：</strong>画面に通知が50件溜まる</li>
                </ul>
                <div class="border-t border-white/10 pt-2 font-bold text-white text-sm">バッテリー（ライフ）とコンボ</div>
                <p>0%になると電源切れになります。ダメージなしの状態を維持し、3秒以内に連続で通知を処理するとコンボ発生！</p>
                <p><strong>10コンボ達成ごと</strong>にボーナスでバッテリーが回復します。</p>
            </div>
        `;
    } else if (type === 'types') {
        titleEl.textContent = '通知の種類とダメージ';
        contentEl.innerHTML = `
            <div class="p-3.5 bg-[#1c1c1e] rounded-2xl border border-white/5 space-y-3">
                <div class="font-bold text-white text-sm">通知の種類について</div>
                <p>スマホには様々な社内通知や理不尽な連絡が届きます。</p>
                <ul class="space-y-2 text-[11px] text-gray-300">
                    <li><strong class="text-blue-400">社内チャット・メール:</strong> 休日対応や無茶振りは右スワイプ（反抗）で回避するのが安全なことも。</li>
                    <li><strong class="text-green-400">電話:</strong> 上司や社長からの不在着信。誠意を見せるか無視するか。</li>
                    <li><strong class="text-pink-400">ヘルスケア:</strong> 長時間作業の警告。エナドリ等でバッテリー回復のチャンス！</li>
                    <li><strong class="text-red-600">システムアラート:</strong> サーバーダウンなどの緊急連絡。</li>
                </ul>
                <p class="text-gray-400">※通知ごとのダメージや選択肢を見極めて最適な対応を選びましょう。</p>
            </div>
        `;
    } else if (type === 'ranking-rule') {
        titleEl.textContent = '評価基準（ランキング）';
        contentEl.innerHTML = `
            <div class="p-3.5 bg-[#1c1c1e] rounded-2xl border border-white/5 space-y-3">
                <div class="font-bold text-white text-sm">ランキングの決定方法</div>
                <p>以下の順番で総合的に評価されます：</p>
                <ol class="list-decimal list-inside space-y-1 text-gray-300">
                    <li>クリアしたかどうか</li>
                    <li>クリアタイムが早い順</li>
                    <li>残充電が多い順</li>
                    <li>捌いた通知数が多い順</li>
                </ol>
                <p class="text-[11px] text-amber-400 mt-2">※「パート（5件）」難易度はランキング対象外となります。ランキング登録にはノーマル（10件）以上をプレイしてください。</p>
            </div>
        `;
    }
}

function closeSettingDetail() {
    document.getElementById('settings-detail-view').classList.add('hidden');
    document.getElementById('settings-main-view').classList.remove('hidden');
    updateSettingsUsernameDisplay();
}

function updateSettingsUsernameDisplay() {
    const subEl = document.getElementById('settings-username-sub');
    if (subEl) {
        subEl.textContent = savedUserName ? savedUserName : '未設定';
    }
}

function saveUsernameFromSettings() {
    const input = document.getElementById('username-input');
    const msg = document.getElementById('username-msg');
    if (!input) return;

    savedUserName = input.value.trim().substring(0, 10);
    input.value = savedUserName;
    updateSettingsUsernameDisplay();

    const rankingInput = document.getElementById('ranking-username-input');
    if (rankingInput) {
        rankingInput.value = savedUserName;
    }
    
    if (msg) {
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 2000);
    }
}

function backToTitle() {
    document.getElementById('clear-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    hideSettings();
    updateCarrierDisplay();
}

function toggleWallpaper() {
    const toggle = document.getElementById('wallpaper-toggle');
    const phoneFrame = document.querySelector('.phone-frame');
    if (toggle && phoneFrame) {
        if (toggle.checked) {
            phoneFrame.classList.remove('no-wallpaper');
        } else {
            phoneFrame.classList.add('no-wallpaper');
        }
    }
}

function changeDifficulty() {
    const select = document.getElementById('difficulty-select');
    targetClearCount = parseInt(select.value, 10);
}

// -----------------------
// 経過時間・フォーマット計算ロジック
// -----------------------
function calculateTimeAgo(createdAt) {
    const diffInSeconds = Math.floor((Date.now() - createdAt) / 1000);
    if (diffInSeconds < 60) return 'たった今';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}分前`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    return `${diffInHours}時間前`;
}

function formatElapsedTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}分${seconds}秒`;
}

function getDifficultyText(count) {
    switch (count) {
        case 5: return 'パート(5件)';
        case 10: return 'ノーマル(10件)';
        case 20: return 'フルタイム(20件)';
        case 30: return 'ハード(30件)';
        default: return `カスタム(${count}件)`;
    }
}

// -----------------------
// ランダム通知生成ロジック
// -----------------------
function createRandomNotification() {
    const id = notificationIdCounter++;
    const createdAt = Date.now();
    let types = ['missedCall', 'chat', 'calendar', 'overtime', 'email', 'expense', 'systemAlert', 'health', 'thanks', 'spam', 'praise'];
    
    if (currentBattery >= 100) {
        types = types.filter(t => t !== 'health');
    }

    const selectedType = types[Math.floor(Math.random() * types.length)];
    const isSpecialCase = Math.random() < 0.5;
    const n = savedUserName ? `${savedUserName}さん、` : '';

    switch (selectedType) {
        case 'missedCall': {
            const missedCount = Math.floor(Math.random() * 300) + 1;
            return {
                id, createdAt, appName: '電話',
                title: isSpecialCase ? `不在着信：社長 (${missedCount}件)` : `不在着信：上司 (${missedCount}件)`,
                icon: 'fa-phone', bgColor: 'bg-green-500',
                actions: isSpecialCase ? [
                    { label: '土下座しながらかけ直す', type: 'slave', damage: 0, msg: '必死の誠意が伝わりノーダメージ！' },
                    { label: '退職届を準備する', type: 'rebel', damage: 30, msg: 'もう何も怖くありません。' }
                ] : [
                    { label: 'すぐかけ直す', type: 'slave', damage: 0, msg: '「すばやい対応だ」と褒められました。' },
                    { label: '電源を切る', type: 'rebel', damage: 20, msg: '物理적으로シャットダウンしました。' }
                ]
            };
        }
        case 'chat': {
            return {
                id, createdAt, appName: '社内チャット',
                title: isSpecialCase ? `部長：${n}休日にごめん、これお願い` : `部長：${n}例の件、今日中によろしく`,
                icon: 'fa-comment-dots', bgColor: 'bg-blue-500',
                actions: isSpecialCase ? [
                    { label: '休日対応する', type: 'slave', damage: 10, msg: '貴重な休みが消滅しました。' },
                    { label: '月曜に見る', type: 'rebel', damage: 0, msg: '休日の権利を守り抜き無傷！' }
                ] : [
                    { label: '「承知いたしました」', type: 'slave', damage: 15, msg: '終電コースが確定しました。' },
                    { label: '定型スタンプのみ返す', type: 'rebel', damage: 0, msg: '定型スタンプでスマートに回避！' }
                ]
            };
        }
        case 'calendar': {
            const hour = Math.floor(Math.random() * 5) + 1;
            return {
                id, createdAt, appName: 'カレンダー',
                title: isSpecialCase ? `このあと ${hour}:00 役員報告会` : `このあと ${hour}:00 任意リフレッシュ会`,
                icon: 'fa-calendar', bgColor: 'bg-red-500',
                actions: isSpecialCase ? [
                    { label: '準備して挑む', type: 'slave', damage: 20, msg: '胃に穴が開きそうです。' },
                    { label: 'すっぽかす', type: 'rebel', damage: 30, msg: '伝説の社員になりました。' }
                ] : [
                    { label: '参加して息抜き', type: 'slave', damage: 0, msg: '雑談でリフレッシュできました。' },
                    { label: '仕事に集中する', type: 'rebel', damage: 0, msg: '自分のペースを維持しました。' }
                ]
            };
        }
        case 'overtime': {
            const hours = Math.floor(Math.random() * 100);
            const mins = Math.floor(Math.random() * 100);
            const hoursStr = hours.toString().padStart(2, '0');
            const minsStr = mins.toString().padStart(2, '0');
            const isHighOvertime = hours >= 45;
            const targetName = savedUserName ? `${savedUserName}の` : '今月の';

            return {
                id, createdAt, appName: '勤怠管理',
                title: `${targetName}残業時間：${hoursStr}時間${minsStr}分`,
                icon: 'fa-stopwatch', bgColor: 'bg-yellow-500',
                actions: isHighOvertime ? [
                    { label: '見なかったことにする', type: 'slave', damage: 5, msg: '次は労基に連絡します。' },
                    { label: '定時打刻を申請', type: 'rebel', damage: 0, msg: 'ノーダメージで申請が完了しました！' }
                ] : [
                    { label: '確認する', type: 'slave', damage: 0, msg: '問題なし！スムーズに確認完了。' },
                    { label: '少しだけ残業をつける', type: 'rebel', damage: 10, msg: '塵も積もれば山となります。' }
                ]
            };
        }
        case 'email': {
            const count = (Math.floor(Math.random() * 2000) + 100).toLocaleString();
            return {
                id, createdAt, appName: 'メール',
                title: isSpecialCase ? `未読 ${count}件(重要あり)` : `未読 ${count}件`,
                icon: 'fa-envelope', bgColor: 'bg-blue-400',
                actions: isSpecialCase ? [
                    { label: '検索フィルターで瞬殺', type: 'slave', damage: 0, msg: '重要メールのみ一元処理完了！' },
                    { label: 'すべて迷惑メールへ', type: 'rebel', damage: 25, msg: '重大な損失が発生した予感がします。' }
                ] : [
                    { label: '一括既読にする', type: 'slave', damage: 0, msg: '一瞬でスッキリ消化しました！' },
                    { label: 'すべて削除する', type: 'rebel', damage: 20, msg: '大事なメールも消え去りました。' }
                ]
            };
        }
        case 'expense': {
            return {
                id, createdAt, appName: '経費精算',
                title: isSpecialCase ? '高額な経費申請が承認されました！' : '経費申請が承認されました',
                icon: 'fa-receipt', bgColor: 'bg-purple-500',
                actions: isSpecialCase ? [
                    { label: '領収書を即提出', type: 'slave', damage: 0, msg: '全額無事に還付されました！' },
                    { label: '経理にお礼を言う', type: 'rebel', damage: 0, msg: '経理部との信頼関係が深まりました。' }
                ] : [
                    { label: '自腹で支払う', type: 'slave', damage: 25, msg: '財布と精神に痛手を受けました。' },
                    { label: '経理に直談判する', type: 'rebel', damage: 20, msg: '経理部を全般的に敵に回しました。' }
                ]
            };
        }
        case 'systemAlert': {
            return {
                id, createdAt, appName: 'システムアラート',
                title: isSpecialCase ? '【超緊急】サーバーダウン' : '【定期】セキュリティ更新のお願い',
                icon: 'fa-triangle-exclamation', bgColor: 'bg-red-600',
                actions: isSpecialCase ? [
                    { label: '叩き起こされて対応', type: 'slave', damage: 35, msg: '睡眠時間が消滅しました。' },
                    { label: 'スマホの電源を切る', type: 'rebel', damage: 20, msg: '朝起きたら大変なことになっていました。' }
                ] : [
                    { label: '今すぐアップデート', type: 'slave', damage: 0, msg: '自動再起動でスムーズに完了！' },
                    { label: 'あとで再起動', type: 'rebel', damage: 0, msg: '後回しにして作業を続行しました。' }
                ]
            };
        }
        case 'health': {
            return {
                id, createdAt, appName: 'ヘルスケア',
                title: isSpecialCase ? '心拍数が異常です。休息を！' : '長時間の作業が続いています',
                icon: 'fa-heart-pulse', bgColor: 'bg-pink-500',
                actions: isSpecialCase ? [
                    { label: '深呼吸する', type: 'slave', damage: 0, msg: '深呼吸して心が落ち着きました。' },
                    { label: '気合いで乗り切る', type: 'rebel', damage: 20, msg: '限界を超えました。' }
                ] : [
                    { label: 'エナドリを飲む', type: 'rebel', damage: -60, msg: 'カフェインを入れて気力を回復しました！' },
                    { label: '軽めのストレッチ', type: 'slave', damage: 0, msg: '身体が軽くなりました！' }
                ]
            };
        }
        case 'thanks': {
            return {
                id, createdAt, appName: '感謝のメッセージ',
                title: `${n}フォロー助かりました！ありがとう！`,
                icon: 'fa-thumbs-up', bgColor: 'bg-emerald-500',
                actions: [
                    { label: '「どういたしまして！」', type: 'slave', damage: 0, msg: 'ほっこり温かい気持ちになりました。' },
                    { label: '「ジュースおごってね」', type: 'rebel', damage: 0, msg: '冗談を言い合える仲間が増えました。' }
                ]
            };
        }
        case 'spam': {
            return {
                id, createdAt, appName: '雑務リマインダー',
                title: '【周知】給湯室の清掃当番について',
                icon: 'fa-broom', bgColor: 'bg-indigo-500',
                actions: [
                    { label: '既読をつけて終了', type: 'slave', damage: 0, msg: 'ノータイムで処理完了！' },
                    { label: 'スタンプで了解', type: 'rebel', damage: 0, msg: '素早いリアクションでスルー成功！' }
                ]
            };
        }
        case 'praise': {
            return {
                id, createdAt, appName: '人事評価',
                title: isSpecialCase ? `【承認】${n}定時退社申請が承認されました` : '今週の業務効率賞に選出されました！',
                icon: 'fa-award', bgColor: 'bg-amber-500',
                actions: [
                    { label: 'ガッツポーズ', type: 'slave', damage: 0, msg: 'モチベーションが維持されました！' },
                    { label: 'さっさと帰宅準備', type: 'rebel', damage: 0, msg: 'ソクホウで退勤の準備を始めました！' }
                ]
            };
        }
        default: {
            return {
                id, createdAt, appName: '人事部',
                title: isSpecialCase ? `【要出頭】${n}人事面談のお知らせ` : '【要回答】従業員満足度アンケート',
                icon: 'fa-clipboard-list', bgColor: 'bg-teal-500',
                actions: isSpecialCase ? [
                    { label: 'おとなしく面談に行く', type: 'slave', damage: 20, msg: 'みっちり絞られました。' },
                    { label: '無断欠席する', type: 'rebel', damage: 30, msg: '退職へのカウントダウンが始まりました。' }
                ] : [
                    { label: 'オール最高評価で送信', type: 'slave', damage: 0, msg: '秒速で回答を終えました！' },
                    { label: '本音の不満を全回答', type: 'rebel', damage: 25, msg: '後日、別室へ呼び出しが決定しました。' }
                ]
            };
        }
    }
}

// -----------------------
// 初期化・タイマー開始
// -----------------------
window.onload = () => {
    setRandomDate();
    startClock();
    isClockStarted = true;
    updateSettingsUsernameDisplay();
};

function init() {
    setRandomDate();
    setRandomBattery();
    
    if (!isClockStarted) {
        startClock();
        isClockStarted = true;
    }

    startNotificationSpawner();
}

function startNotificationSpawner() {
    if (spawnIntervalId) clearInterval(spawnIntervalId);
    spawnIntervalId = setInterval(() => {
        if (currentBattery <= 0) return;

        if (activeNotifications.length >= 50) {
            showGameOverScreen('overflow');
            return;
        }

        const newNotif = createRandomNotification();
        activeNotifications.unshift(newNotif);
        renderNotifications();
    }, 2500);
}

function setRandomDate() {
    const dateDisplay = document.getElementById('date-display');
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1; 
    const daysOfWeek = ['(日)', '(月)', '(火)', '(水)', '(木)', '(金)', '(土)'];
    const randomDayOfWeek = daysOfWeek[Math.floor(Math.random() * daysOfWeek.length)];
    dateDisplay.textContent = `${month}月${day}日 ${randomDayOfWeek}`;
}

function setRandomBattery() {
    currentBattery = 100;
    initialBattery = 100;
    updateBatteryDisplay(currentBattery);
}

function updateBatteryDisplay(percent) {
    const batteryText = document.getElementById('battery-text');
    const batteryIcon = document.getElementById('battery-icon');
    if (!batteryText || !batteryIcon) return;

    batteryText.textContent = `${percent}%`;
    batteryIcon.className = 'fa-solid text-lg';
    batteryText.classList.remove('text-red-500');

    if (percent > 80) {
        batteryIcon.classList.add('fa-battery-full');
    } else if (percent > 50) {
        batteryIcon.classList.add('fa-battery-three-quarters');
    } else if (percent > 25) {
        batteryIcon.classList.add('fa-battery-half');
    } else if (percent > 10) {
        batteryIcon.classList.add('fa-battery-quarter', 'text-red-500');
        batteryText.classList.add('text-red-500');
    } else {
        batteryIcon.classList.add('fa-battery-empty', 'text-red-500');
        batteryText.classList.add('text-red-500');
    }
}

function showBatteryBonusText(bonusAmount) {
    const bonusEl = document.getElementById('battery-bonus-pop');
    const batteryIcon = document.getElementById('battery-icon');
    if (!bonusEl) return;

    bonusEl.textContent = `+${bonusAmount}%`;
    bonusEl.classList.remove('opacity-0', 'translate-y-0');
    bonusEl.classList.add('opacity-100', 'translate-y-1', 'text-green-400');

    if (batteryIcon) {
        batteryIcon.classList.add('text-green-400');
    }

    setTimeout(() => {
        bonusEl.classList.remove('opacity-100', 'translate-y-1');
        bonusEl.classList.add('opacity-0', 'translate-y-0');
        if (batteryIcon && currentBattery > 10) {
            batteryIcon.classList.remove('text-green-400');
        }
    }, 1200);
}

function updateCarrierDisplay(combo = 0) {
    const carrierEl = document.getElementById('carrier-text');
    if (!carrierEl) return;

    if (comboTimerId) {
        clearTimeout(comboTimerId);
        comboTimerId = null;
    }

    if (combo >= 2) {
        carrierEl.textContent = `${combo} COMBO`;
        carrierEl.classList.add('combo-active');

        comboTimerId = setTimeout(() => {
            carrierEl.textContent = 'mobile';
            carrierEl.classList.remove('combo-active');
        }, 3500);
    } else {
        carrierEl.textContent = 'mobile';
        carrierEl.classList.remove('combo-active');
    }
}

function startClock() {
    const timeDisplay = document.getElementById('time-display');
    function update() {
        const now = new Date();
        const hours = now.getHours().toString();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        timeDisplay.textContent = `${hours}:${minutes}`;
    }
    update();
    setInterval(update, 1000);
}

// -----------------------
// UI描画・インタラクション
// -----------------------
function renderNotifications() {
    const container = document.getElementById('notification-container');

    activeNotifications.forEach(notif => {
        let card = document.getElementById(`notif-${notif.id}`);
        
        if (card) {
            const timeSpan = card.querySelector('.time-ago');
            if (timeSpan) {
                timeSpan.textContent = calculateTimeAgo(notif.createdAt);
            }
            return;
        }

        card = document.createElement('div');
        card.className = `glass-card p-3 text-white shrink-0`;
        card.id = `notif-${notif.id}`;
        if (!notif.actions || notif.actions.length === 0) {
            card.style.cursor = 'default';
        }
        card.onclick = () => toggleExpand(notif.id);

        const mainContent = document.createElement('div');
        mainContent.className = 'flex items-center gap-3';
        mainContent.innerHTML = `
            <div class="w-10 h-10 rounded-xl ${notif.bgColor} flex items-center justify-center shrink-0 shadow">
                <i class="fa-solid ${notif.icon} text-lg text-white"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center">
                    <span class="text-sm font-bold tracking-wide text-white">${notif.appName}</span>
                    <span class="time-ago text-[10px] text-gray-300 ml-2 shrink-0">${calculateTimeAgo(notif.createdAt)}</span>
                </div>
                <div class="text-xs font-medium text-gray-100 mt-0.5 leading-snug break-words">${notif.title}</div>
            </div>
        `;

        const actionsArea = document.createElement('div');
        actionsArea.className = 'actions-area flex gap-2';
        
        if (notif.actions) {
            notif.actions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = `flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                    action.type === 'slave' 
                    ? 'bg-blue-600/80 hover:bg-blue-500' 
                    : 'bg-red-600/80 hover:bg-red-500'
                }`;
                btn.textContent = action.label;
                
                btn.onclick = (e) => {
                    e.stopPropagation();
                    handleAction(notif.id, action.msg, action.damage, action.type, action.type === 'slave' ? 'left' : 'right');
                };
                
                actionsArea.appendChild(btn);
            });
        }

        card.appendChild(mainContent);
        card.appendChild(actionsArea);
        
        attachSwipeEvents(card, notif);
        container.insertBefore(card, container.firstChild);
    });
}

function attachSwipeEvents(card, notif) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    const onStart = (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        card.classList.add('swiping');
    };

    const onMove = (e) => {
        if (!isDragging) return;
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        currentX = x - startX;

        card.style.transform = `translateX(${currentX}px)`;

        if (currentX > 30) {
            card.style.backgroundColor = 'rgba(239, 68, 68, 0.35)';
        } else if (currentX < -30) {
            card.style.backgroundColor = 'rgba(59, 130, 246, 0.35)';
        } else {
            card.style.backgroundColor = '';
        }
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        card.classList.remove('swiping');
        card.style.transform = '';
        card.style.backgroundColor = '';

        const threshold = 70;
        if (currentX < -threshold) {
            if (notif.actions && notif.actions[0]) {
                const act = notif.actions[0];
                handleAction(notif.id, act.msg, act.damage, act.type, 'left');
            }
        } else if (currentX > threshold) {
            if (notif.actions && notif.actions[1]) {
                const act = notif.actions[1];
                handleAction(notif.id, act.msg, act.damage, act.type, 'right');
            }
        }
        currentX = 0;
    };

    card.addEventListener('touchstart', onStart, { passive: true });
    card.addEventListener('touchmove', onMove, { passive: true });
    card.addEventListener('touchend', onEnd);

    card.addEventListener('mousedown', onStart);
    const onMouseMove = (e) => { if (isDragging) onMove(e); };
    const onMouseUp = () => { if (isDragging) onEnd(); };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

function toggleExpand(id) {
    const notif = activeNotifications.find(n => n.id === id);
    if (!notif || !notif.actions || notif.actions.length === 0) return;

    const card = document.getElementById(`notif-${id}`);
    if (!card) return;
    
    document.querySelectorAll('.glass-card.expanded').forEach(el => {
        if (el.id !== `notif-${id}`) {
            el.classList.remove('expanded');
        }
    });

    card.classList.toggle('expanded');
}

function handleAction(id, message, damage = 10, actionType = 'slave', direction = 'right') {
    const card = document.getElementById(`notif-${id}`);
    if (!card) return;

    const now = Date.now();
    const timeDiff = now - lastClearedTime;

    if (damage <= 0) {
        if (lastClearedTime && timeDiff < 3000) {
            comboCount++;
        } else {
            comboCount = 1;
        }
    } else {
        comboCount = 0;
    }
    lastClearedTime = now;

    currentBattery = Math.min(100, Math.max(0, currentBattery - damage));

    const phoneFrame = document.querySelector('.phone-frame');
    if (damage >= 20) {
        phoneFrame.classList.add('shake');
        setTimeout(() => phoneFrame.classList.remove('shake'), 400);
    }

    let displayMessage = message;
    if (comboCount > 0 && comboCount % 10 === 0) {
        const bonusBattery = 15;
        currentBattery = Math.min(100, currentBattery + bonusBattery);
        showBatteryBonusText(bonusBattery);

        phoneFrame.classList.add('battery-pulse');
        setTimeout(() => phoneFrame.classList.remove('battery-pulse'), 600);
    } else if (damage < 0) {
        showBatteryBonusText(Math.abs(damage));
        phoneFrame.classList.add('battery-pulse');
        setTimeout(() => phoneFrame.classList.remove('battery-pulse'), 600);
    }

    updateCarrierDisplay(comboCount);
    updateBatteryDisplay(currentBattery);

    activeNotifications = activeNotifications.filter(n => n.id !== id);
    clearedNotificationsCount++;

    if (direction === 'left') {
        card.classList.add('slide-out-left');
    } else {
        card.classList.add('slide-out-right');
    }
    showToast(displayMessage);

    setTimeout(() => {
        card.remove();
        if (currentBattery <= 0) {
            showGameOverScreen('battery');
        } else if (clearedNotificationsCount >= targetClearCount && activeNotifications.length === 0) {
            showClearScreen();
        }
    }, 350);
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerHTML = message;
    toast.classList.add('show');
    
    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
    }
    
    toastTimeoutId = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

function hideToastImmediately() {
    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
        toastTimeoutId = null;
    }
    const toast = document.getElementById('toast');
    if (toast) {
        toast.classList.remove('show');
    }
}

function prepareResultData(isClear = true) {
    const elapsedTimeMs = Date.now() - gameStartTime;
    lastGameResult = {
        difficulty: targetClearCount.toString(),
        clearTimeSeconds: Math.floor(elapsedTimeMs / 1000),
        clearTimeStr: formatElapsedTime(elapsedTimeMs),
        startBattery: initialBattery,
        endBattery: currentBattery,
        clearedCount: Number(clearedNotificationsCount) || 0,
        isClear: isClear ? 1 : 0
    };

    const rankingInput = document.getElementById('ranking-username-input');
    if (rankingInput) {
        rankingInput.value = savedUserName || "";
    }

    // パート（難易度5）の場合はランキング登録エリアを非表示にする
    const submitArea = document.getElementById('ranking-submit-area');
    if (targetClearCount === 5) {
        if (submitArea) submitArea.classList.add('hidden');
    } else {
        if (submitArea) submitArea.classList.remove('hidden');
    }

    resetResultSubmitState();
    updateResultSummaryCard();
}

function resetResultSubmitState() {
    isScoreSubmitted = false;
    
    const nameInput = document.getElementById('ranking-username-input');
    if (nameInput) {
        nameInput.disabled = false;
        nameInput.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-black/80');
    }

    const btn = document.getElementById('ranking-submit-btn');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i> 登録';
        btn.className = 'px-3.5 py-2 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 active:scale-95 rounded-xl text-xs font-bold text-white shadow-md transition-all shrink-0 flex items-center justify-center gap-1 whitespace-nowrap border border-blue-400/50';
    }
    const msgEl = document.getElementById('ranking-submit-msg');
    if (msgEl) {
        msgEl.classList.add('hidden');
        msgEl.textContent = '';
    }
}

function updateResultSummaryCard() {
    if (!lastGameResult) return;

    const clearedEl = document.getElementById('res-cleared-count');
    const timeEl = document.getElementById('res-clear-time');
    const batteryEl = document.getElementById('res-battery');
    const diffEl = document.getElementById('res-difficulty');

    const count = (typeof lastGameResult.clearedCount === 'number') ? lastGameResult.clearedCount : clearedNotificationsCount;
    if (clearedEl) clearedEl.textContent = `${count}件`;
    if (timeEl) timeEl.textContent = lastGameResult.clearTimeStr;
    if (batteryEl) batteryEl.textContent = `${lastGameResult.endBattery}%`;
    if (diffEl) diffEl.textContent = getDifficultyText(parseInt(lastGameResult.difficulty, 10));
}

function updateDummyWidgets(isClear) {
    const weatherIcon = document.getElementById('widget-weather-icon');
    const weatherText = document.getElementById('widget-weather-text');
    const stockIcon = document.getElementById('widget-stock-icon');
    const stockText = document.getElementById('widget-stock-text');
    const newBestTag = document.getElementById('new-best-tag');

    const elapsedTimeMs = Date.now() - gameStartTime;
    const elapsedSeconds = Math.max(1, Math.floor(elapsedTimeMs / 1000));

    let score = Math.floor((clearedNotificationsCount * currentBattery * 100) / elapsedSeconds);

    if (!isClear) {
        score = Math.floor(score / 2);
    }

    const storageKey = `notif_survival_best_score_${targetClearCount}`;
    const previousBest = parseInt(localStorage.getItem(storageKey) || "0", 10);
    
    if (score > previousBest) {
        localStorage.setItem(storageKey, score.toString());
        if (newBestTag) newBestTag.classList.remove('hidden');
    } else {
        if (newBestTag) newBestTag.classList.add('hidden');
    }

    if (weatherIcon) weatherIcon.className = 'fa-solid fa-star text-amber-400 text-2xl shrink-0';
    if (weatherText) {
        weatherText.textContent = `${score.toLocaleString()} pts`;
        weatherText.className = 'text-xl font-black text-amber-300 truncate tracking-tight';
    }

    let rank = 'C';
    let rankColor = 'text-gray-300';
    if (score >= 5000) {
        rank = 'S';
        rankColor = 'text-amber-300';
    } else if (score >= 2500) {
        rank = 'A';
        rankColor = 'text-green-400';
    } else if (score >= 1000) {
        rank = 'B';
        rankColor = 'text-blue-400';
    }

    if (stockIcon) stockIcon.className = 'fa-solid fa-trophy text-amber-400 text-xl';
    if (stockText) {
        stockText.textContent = rank;
        stockText.className = `text-base font-black ${rankColor}`;
    }
}

function showGameOverScreen(reason = 'battery') {
    if (spawnIntervalId) clearInterval(spawnIntervalId);
    hideToastImmediately();

    prepareResultData(false);
    updateDummyWidgets(false);

    const clearScreen = document.getElementById('clear-screen');
    const icon = document.getElementById('end-icon');
    const title = document.getElementById('end-title');
    const desc = document.getElementById('end-desc');

    if (reason === 'battery') {
        icon.className = 'fa-solid fa-battery-empty text-4xl text-red-500 drop-shadow-md';
        title.textContent = '電源切れ';
        desc.textContent = 'バッテリーが切れ、音信不通になりました...';
    } else if (reason === 'overflow') {
        icon.className = 'fa-solid fa-dumpster-fire text-4xl text-yellow-500 drop-shadow-md';
        title.textContent = '処理落ち';
        desc.textContent = '通知が溜まりすぎて熱暴走しました...';
    }

    clearScreen.classList.remove('hidden');
}

function showClearScreen() {
    if (spawnIntervalId) clearInterval(spawnIntervalId);
    hideToastImmediately();

    prepareResultData(true);
    updateDummyWidgets(true);

    document.querySelector('.phone-frame').classList.add('clear-bg');
    document.getElementById('date-display').textContent = 'MISSION CLEAR';

    document.getElementById('clear-screen').classList.remove('hidden');
    document.getElementById('end-icon').className = 'fa-solid fa-trophy text-4xl text-amber-400 drop-shadow-md';
    document.getElementById('end-title').textContent = 'MISSION CLEAR!';
    document.getElementById('end-desc').textContent = 'すべての業務通知を完璧に捌き切りました！';
}

function openRankingModal(diff) {
    if (diff) {
        currentRankingDifficulty = diff;
    } else {
        currentRankingDifficulty = targetClearCount === 5 ? "10" : targetClearCount.toString();
    }
    
    document.getElementById('ranking-modal').classList.remove('hidden');
    switchRankingTab(currentRankingDifficulty);
}

function closeRankingModal() {
    document.getElementById('ranking-modal').classList.add('hidden');
}

function switchRankingTab(diff) {
    currentRankingDifficulty = diff;

    ['10', '20', '30'].forEach(d => {
        const tab = document.getElementById(`tab-diff-${d}`);
        if (tab) {
            if (d === diff) {
                tab.className = 'flex-1 py-1.5 rounded-md font-bold transition-all bg-amber-500 text-black';
            } else {
                tab.className = 'flex-1 py-1.5 rounded-md font-bold transition-all text-gray-300 hover:text-white';
            }
        }
    });

    fetchRanking(diff);
}

async function fetchRanking(diff) {
    const listContainer = document.getElementById('ranking-list');
    listContainer.innerHTML = '<div class="text-center py-8 text-gray-400">読み込み中...</div>';

    try {
        const response = await fetch(`/api/ranking?difficulty=${diff}`);
        if (!response.ok) throw new Error('取得失敗');
        const data = await response.json();

        if (!data || data.length === 0) {
            listContainer.innerHTML = '<div class="text-center py-8 text-gray-500 text-xs">まだ記録がありません。</div>';
            updateUserRankStatus([]);
            return;
        }

        listContainer.innerHTML = '';
        data.forEach((item, index) => {
            const rank = index + 1;
            let badgeClass = 'rank-other';
            if (rank === 1) badgeClass = 'rank-1';
            else if (rank === 2) badgeClass = 'rank-2';
            else if (rank === 3) badgeClass = 'rank-3';

            const clearedCount = item.clearedCount ?? item.cleared_count ?? 0;
            const clearedStr = `${clearedCount}件`;
            
            const endBattery = item.endBattery ?? 0;
            const clearTimeSec = item.clearTimeSeconds || 1;
            const isClear = item.isClear ?? item.is_clear ?? 1;
            let itemScore = Math.floor((clearedCount * endBattery * 100) / Math.max(1, clearTimeSec));
            if (!isClear) itemScore = Math.floor(itemScore / 2);

            const row = document.createElement('div');
            row.className = 'grid grid-cols-12 items-center p-2 rounded bg-white/5 border border-white/5 text-xs';
            row.innerHTML = `
                <div class="col-span-2">
                    <span class="rank-badge ${badgeClass}">${rank}</span>
                </div>
                <div class="col-span-4 font-bold truncate pr-1">${escapeHtml(item.username || '名無し')}</div>
                <div class="col-span-2 text-right text-gray-300 font-mono text-[11px]">${clearedStr}</div>
                <div class="col-span-2 text-right text-gray-300 font-mono text-[11px]">${item.clearTimeStr || '-'}</div>
                <div class="col-span-2 text-right font-mono text-amber-300 text-[10px] whitespace-nowrap">${itemScore.toLocaleString()}</div>
            `;
            listContainer.appendChild(row);
        });

        updateUserRankStatus(data);

    } catch (err) {
        console.error(err);
        listContainer.innerHTML = '<div class="text-center py-8 text-red-400 text-xs">読み込みに失敗しました</div>';
        updateUserRankStatus([]);
    }
}

function updateUserRankStatus(rankingData) {
    const statusEl = document.getElementById('user-rank-status');
    if (!statusEl) return;

    const diffText = getDifficultyText(parseInt(currentRankingDifficulty, 10));

    if (!savedUserName) {
        statusEl.innerHTML = `<i class="fa-solid fa-circle-info mr-1"></i>あなたはまだ未登録です。<br>ノーマル以上でプレイしてランキングに登録しよう！`;
        statusEl.classList.remove('hidden');
        return;
    }

    const myEntryIndex = rankingData.findIndex(item => item.username === savedUserName);

    if (myEntryIndex !== -1) {
        const rank = myEntryIndex + 1;
        statusEl.innerHTML = `<i class="fa-solid fa-circle-check text-green-400 mr-1"></i><strong>${escapeHtml(savedUserName)}</strong> さんの【${diffText}】最高順位: <strong>${rank}位</strong>`;
        statusEl.classList.remove('hidden');
    } else {
        statusEl.innerHTML = `<i class="fa-solid fa-circle-info mr-1"></i><strong>${escapeHtml(savedUserName)}</strong> さんは【${diffText}】未登録です。<br>ノーマル以上でプレイしてランキングに登録しよう！`;
        statusEl.classList.remove('hidden');
    }
}

async function generateSignature(data) {
    const secret = "notif_survival_secret";
    const message = `${data.difficulty}-${data.username}-${data.clearTimeSeconds}-${data.clearedCount}-${secret}`;
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function submitRankingScore() {
    if (isScoreSubmitted) return;
    if (targetClearCount === 5) return; // パートは登録不可

    const nameInput = document.getElementById('ranking-username-input');
    const msgEl = document.getElementById('ranking-submit-msg');
    const btn = document.getElementById('ranking-submit-btn');
    const name = nameInput.value.trim().substring(0, 10);

    if (!name) {
        msgEl.textContent = '名前を入力してください (10文字以内)';
        msgEl.className = 'text-[10px] text-red-400 mt-1.5 text-center font-medium';
        msgEl.classList.remove('hidden');
        return;
    }

    if (!lastGameResult) return;

    msgEl.textContent = '登録中...';
    msgEl.className = 'text-[10px] text-blue-300 mt-1.5 text-center font-medium';
    msgEl.classList.remove('hidden');

    try {
        const payload = {
            ...lastGameResult,
            username: name
        };

        payload.signature = await generateSignature(payload);

        const response = await fetch('/api/ranking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('送信エラー');

        savedUserName = name;
        updateSettingsUsernameDisplay();

        isScoreSubmitted = true;
        if (nameInput) {
            nameInput.disabled = true;
            nameInput.classList.add('opacity-50', 'cursor-not-allowed', 'bg-black/80');
        }
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> 登録済';
            btn.className = 'px-3 py-1.5 bg-gray-600/80 text-gray-300 cursor-not-allowed rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1 opacity-80 whitespace-nowrap border border-gray-500/30';
        }

        msgEl.textContent = '登録が完了しました！';
        msgEl.className = 'text-[10px] text-green-400 mt-1.5 text-center font-medium';

        setTimeout(() => {
            if (msgEl) msgEl.classList.add('hidden');
        }, 2500);

        setTimeout(() => {
            openRankingModal(lastGameResult.difficulty);
        }, 800);

    } catch (err) {
        console.error(err);
        msgEl.textContent = '登録に失敗しました';
        msgEl.className = 'text-[10px] text-red-400 mt-1.5 text-center font-medium';
    }
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}
