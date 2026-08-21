/* Bilingual UI (vi / en).
 *
 * Two mechanisms, deliberately:
 *   t('key')  short UI strings from the dictionary below
 *   L(obj)    long-form content that lives with its own module as {vi, en}
 *
 * Long content stays next to what it describes — a tier's explanation belongs in
 * difficulty.js, not in a translation file half a repo away — while chrome and
 * labels are centralised here so a missing one is obvious.
 */
(function (global) {
  'use strict';

  var KEY = 'carsort.lang';
  var lang = 'en';                 /* default; a stored choice always wins */
  try { var st = localStorage.getItem(KEY); if (st === 'en' || st === 'vi') lang = st; } catch (e) {}

  var D = {
    /* header */
    prevLevel:    { vi: 'Level trước', en: 'Previous level' },
    nextLevel:    { vi: 'Level sau', en: 'Next level' },
    level:        { vi: 'Level', en: 'Level' },
    moves:        { vi: 'Moves', en: 'Moves' },
    restart:      { vi: 'Restart', en: 'Restart' },
    undo:         { vi: 'Undo', en: 'Undo' },
    hint:         { vi: 'Hint', en: 'Hint' },
    autoplay:     { vi: 'Autoplay', en: 'Autoplay' },
    hideBoard:    { vi: 'Ẩn puzzle', en: 'Hide puzzle' },
    showBoard:    { vi: 'Hiện puzzle', en: 'Show puzzle' },
    boardToggleT: { vi: 'Ẩn/hiện khung puzzle — chỉ là hiển thị, không ảnh hưởng logic (phím B)',
                    en: 'Hide/show the puzzle panel — display only, no effect on logic (key B)' },
    modeTest:     { vi: '▶ Test', en: '▶ Test' },
    modePlaytune: { vi: '🎮 Chơi & cân', en: '🎮 Play & tune' },
    modeDesign:   { vi: '⚙ Level Design', en: '⚙ Level Design' },
    modeTestT:    { vi: 'Chỉ chơi và đọc chỉ số, không sửa được gì',
                    en: 'Play and read the numbers only — nothing here can edit' },
    modePlaytuneT:{ vi: 'Chơi rồi nâng/hạ bậc ngay tại bàn, ghi nhật ký',
                    en: 'Play, then raise or lower the step at the board; every run is logged' },
    modeDesignT:  { vi: 'Sửa lưới, cân độ khó, game feel',
                    en: 'Edit the grid, balance difficulty, tune game feel' },
    guide:        { vi: 'Hướng dẫn', en: 'Guide' },
    guideT:       { vi: 'Hướng dẫn nhanh', en: 'Quick guide' },
    buildT:       { vi: 'thời điểm src/tool.js sửa lần cuối — dùng để biết browser đã nạp bản mới chưa',
                    en: 'last-modified time of src/tool.js — tells you whether the browser loaded the new build' },
    setPickT:     { vi: 'Đổi bộ là chơi lại từ level 1', en: 'Switching campaign restarts from level 1' },
    gcQuickOne:   { vi: '⬇ JSON', en: '⬇ JSON' },
    gcQuickOneT:  { vi: 'Tải level đang mở thành level_N.json — format client ConfigVersion 1',
                    en: 'Download the level on screen as level_N.json — client format, ConfigVersion 1' },
    gcQuickAll:   { vi: '⬇ JSON cả bộ', en: '⬇ JSON, whole set' },
    gcQuickAllT:  { vi: 'Tải từng level của bộ thành một file, mỗi file cách nhau một nhịp vì browser chặn download dồn cùng lúc',
                    en: 'Download every level in the campaign as its own file, one at a time — browsers drop downloads fired together' },

    /* tabs */
    tabCurve:     { vi: 'Độ khó', en: 'Difficulty' },
    tabPlay:      { vi: 'Play', en: 'Play' },
    tabJournal:   { vi: 'Nhật ký', en: 'Journal' },
    tabTune:      { vi: 'Tune', en: 'Tune' },
    tabEdit:      { vi: 'Edit', en: 'Edit' },
    tabPlaytest:  { vi: 'Playtest', en: 'Playtest' },
    tabFeel:      { vi: 'Feel', en: 'Feel' },
    tabSet:       { vi: 'Level Set', en: 'Level Set' },

    /* play tab */
    measureThis:  { vi: 'Đo level này', en: 'Measure this level' },
    measureAgain: { vi: 'Đo lại', en: 'Measure again' },
    measuring:    { vi: 'đang đo…', en: 'measuring…' },
    measureHint:  { vi: 'chạy solver + playtest nhanh để xem chỉ số',
                    en: 'runs the solver and a quick playtest to show the numbers' },
    curLevel:     { vi: 'Level hiện tại', en: 'Current level' },
    howToRead:    { vi: 'Đọc số thế nào', en: 'How to read the numbers' },
    howToReadA:   { vi: 'Bấm dấu', en: 'Click the' },
    howToReadB:   { vi: 'cạnh bất kỳ con số nào để xem giải thích kèm ví dụ lấy từ chính 10 level này.',
                    en: 'beside any number for an explanation, worked through these ten levels.' },
    moveLog:      { vi: 'Move log', en: 'Move log' },

    /* difficulty tab */
    measureWholeSet: { vi: 'Đo cả bộ', en: 'Measure whole campaign' },
    fourSets:     { vi: 'Các bộ cạnh nhau', en: 'All campaigns side by side' },
    activeSet:    { vi: 'Bộ đang chọn', en: 'Active campaign' },
    perLevel:     { vi: 'Từng level', en: 'Level by level' },
    setWord:      { vi: 'Bộ', en: 'Campaign' },
    breathersN:   { vi: 'chỗ nghỉ chủ ý', en: 'intended breathers' },
    stepRange:    { vi: 'bậc', en: 'step' },
    tierEstimate: { vi: 'ước lượng theo bậc', en: 'estimated from the step' },
    legTier:      { vi: 'bậc', en: 'step' },
    legTierB:     { vi: 'bậc ở chỗ nghỉ chủ ý', en: 'step at an intended breather' },
    legWinC:      { vi: 'win giỏi', en: 'win — careful' },
    legWinA:      { vi: 'win trung bình', en: 'win — average' },
    legWinS:      { vi: 'win ẩu', en: 'win — careless' },
    legRhythmAvg: { vi: 'nhịp của bộ này đọc trên player trung bình',
                    en: 'this campaign\'s rhythm reads on the average player' },
    legRhythmSlo: { vi: 'nhịp của bộ này đọc trên player ẩu',
                    en: 'this campaign\'s rhythm reads on the careless player' },
    pressMeasure: { vi: 'bấm <b>Đo cả bộ</b> để vẽ tỉ lệ thắng thật',
                    en: 'press <b>Measure whole campaign</b> to plot the real win rates' },
    legBreather:  { vi: '● = chỗ nghỉ chủ ý', en: '● = intended breather' },
    active:       { vi: 'đang chọn', en: 'active' },
    noTierSet:    { vi: 'không khai bậc — nó là bàn dựng lại từ ảnh chụp, không sinh từ thang bậc. Bấm <b>Đo cả bộ</b> để xem tỉ lệ thắng thật của nó, hoặc so nó với ba bộ kia ở biểu đồ trên.',
                    en: 'declares no steps — these boards were rebuilt from screenshots rather than generated from the ladder. Press <b>Measure whole campaign</b> for its real win rates, or compare it with the other three in the chart above.' },
    noTierRow:    { vi: 'bộ này không khai bậc', en: 'this campaign declares no step' },
    breatherTag:  { vi: 'chỗ nghỉ chủ ý', en: 'intended breather' },
    group:        { vi: 'nhóm', en: 'group' },
    budget:       { vi: 'budget', en: 'budget' },

    /* journal */
    lockedTiers:  { vi: 'Bậc đã chốt cho từng level', en: 'Signed-off step per level' },
    tierCurve:    { vi: 'Curve bậc', en: 'Step curve' },
    runLog:       { vi: 'Nhật ký lượt chơi', en: 'Run log' },
    clearLog:     { vi: 'Xoá nhật ký', en: 'Clear log' },
    copyJson:     { vi: 'Copy JSON', en: 'Copy JSON' },
    runs:         { vi: 'lượt', en: 'runs' },
    colLevel:     { vi: 'level', en: 'level' },
    colSize:      { vi: 'size', en: 'size' },
    colBudget:    { vi: 'budget', en: 'budget' },
    colWorking:   { vi: 'bậc đang dựng', en: 'working step' },
    colLocked:    { vi: 'bậc đã chốt', en: 'signed off' },
    colRuns:      { vi: 'lượt đã chơi', en: 'runs played' },
    fromSet:      { vi: '(bộ)', en: '(campaign)' },
    noRunsYet:    { vi: 'chưa có lượt nào — chơi ở chế độ Chơi & cân là tự ghi',
                    en: 'no runs yet — playing in Play & tune records them automatically' },
    won:          { vi: 'thắng', en: 'won' },
    lost:         { vi: 'thua', en: 'lost' },
    signedOff:    { vi: 'chốt bậc', en: 'signed off' },
    spare:        { vi: 'thừa', en: 'spare' },
    estAvg:       { vi: 'máy đo TB', en: 'measured avg' },
    curveLegend:  { vi: 'xanh lá = bậc đã chốt · tím = bậc đang dựng chưa chốt',
                    en: 'green = signed off · purple = working step, not signed off' },
    noTierLocked: { vi: 'chưa chốt bậc nào', en: 'no step signed off yet' },

    /* play & tune strip */
    lowerTier:    { vi: '− Hạ bậc', en: '− Lower step' },
    raiseTier:    { vi: '+ Nâng bậc', en: '+ Raise step' },
    rerollBoard:  { vi: '⟳ Đổi bàn khác cùng bậc', en: '⟳ Reroll board, same step' },
    lockTier:     { vi: '✓ Chốt bậc', en: '✓ Sign off step' },
    lockedAlready:{ vi: '✓ Đã chốt', en: '✓ Signed off' },
    lockedBadge:  { vi: '✓ đã chốt bậc', en: '✓ signed off step' },
    unknownTier:  { vi: 'chưa rõ bậc', en: 'step unknown' },
    estimateIs:   { vi: 'ước lượng: win TB', en: 'estimate: win avg' },
    careless:     { vi: 'ẩu', en: 'careless' },
    detectingTier:{ vi: 'đang đo để xác định bậc hiện tại…', en: 'measuring to identify the current step…' },
    buildingTier: { vi: 'Đang dựng bàn ở bậc', en: 'Building a board at step' },
    cannotBuild:  { vi: 'Không dựng được', en: 'Could not build' },
    cannotBuildB: { vi: 'Không sinh được bàn hợp lệ ở bậc', en: 'No valid board could be generated at step' },
    nextLevelBtn: { vi: 'Sang level sau', en: 'Next level' },
    stayHere:     { vi: 'Ở lại', en: 'Stay here' },
    curveSmooth:  { vi: 'Curve vẫn mượt.', en: 'The ramp is still smooth.' },
    curveIssues:  { vi: 'Curve có chỗ đáng xem lại:', en: 'The ramp has something worth a look:' },

    /* result screen */
    cleared:      { vi: 'HOÀN THÀNH', en: 'CLEARED' },
    outOfMoves:   { vi: 'HẾT MOVE', en: 'OUT OF MOVES' },
    replayLevel:  { vi: 'Chơi lại level này', en: 'Replay this level' },
    replay:       { vi: '↺ Chơi lại', en: '↺ Replay' },
    backToFirst:  { vi: '↺ Về level đầu', en: '↺ Back to level 1' },
    undoOne:      { vi: 'Undo 1 nước', en: 'Undo one move' },
    continueFor:  { vi: 'move, chơi tiếp', en: 'more moves, keep going' },
    tapAnywhere:  { vi: 'bấm bất kỳ đâu để', en: 'tap anywhere to' },
    doneCols:     { vi: 'xong', en: 'cleared' },
    colsWord:     { vi: 'cột', en: 'columns' },
    usedMoves:    { vi: 'dùng', en: 'used' },

    /* tune tab */
    tplTitle:     { vi: 'Template độ khó', en: 'Difficulty templates' },
    applyTo:      { vi: 'Áp dụng cho', en: 'Apply to' },
    scopeOne:     { vi: 'chỉ level đang chọn', en: 'this level only' },
    scopeAll:     { vi: 'toàn bộ level', en: 'every level' },
    scopeRange:   { vi: 'khoảng tuỳ chọn', en: 'custom range' },
    from:         { vi: 'từ', en: 'from' },
    to:           { vi: 'đến', en: 'to' },
    seed:         { vi: 'seed', en: 'seed' },
    editTpl:      { vi: 'Sửa template (JSON)', en: 'Edit templates (JSON)' },
    loadThisJson: { vi: 'Nạp JSON này', en: 'Load this JSON' },
    resetDefault: { vi: 'Về mặc định', en: 'Reset to default' },
    tuneTitle:    { vi: 'Cân chỉnh độ khó', en: 'Difficulty tuning' },
    wantHarder:   { vi: 'Muốn khó hơn', en: 'Make it harder' },
    wantEasier:   { vi: 'Muốn dễ hơn', en: 'Make it easier' },
    playoutsPer:  { vi: 'playout / phương án', en: 'playouts per option' },
    solverTitle:  { vi: 'Phân tích solver', en: 'Solver analysis' },
    analyzeThis:  { vi: 'Analyze level này', en: 'Analyze this level' },
    nodeCap:      { vi: 'node cap', en: 'node cap' },
    playoutsW:    { vi: 'playouts', en: 'playouts' },
    mistakeRate:  { vi: 'lỗi tay', en: 'mistake rate' },
    verdict:      { vi: 'Đánh giá', en: 'Verdict' },
    moveBudget:   { vi: 'Move budget', en: 'Move budget' },
    slackTarget:  { vi: 'slack mục tiêu', en: 'target slack' },
    setBudgetBtn: { vi: 'Set budget = minMoves × slack', en: 'Set budget = minMoves × slack' },
    bestSolution: { vi: 'Lời giải tối ưu', en: 'Optimal solution' },
    notAnalyzed:  { vi: 'chưa analyze', en: 'not analyzed yet' },
    applyBtn:     { vi: 'Áp dụng cho', en: 'Apply to' },
    rebudgetOnly: { vi: 'Chỉ đặt lại budget', en: 'Re-budget only' },
    rebudgetT:    { vi: 'Giữ nguyên lưới, chỉ đặt budget theo slack của bậc',
                    en: 'Keep the grid, just set the budget from the step\'s slack' },
    whyThisStep:  { vi: '▸ Vì sao bậc này khó theo kiểu đó', en: '▸ Why this step is hard the way it is' },
    sampleBoard:  { vi: 'Bàn mẫu', en: 'Sample board' },
    strayCars:    { vi: 'xe lạ', en: 'stray cars' },
    hiddenCars:   { vi: 'xe ẩn', en: 'hidden cars' },
    noHidden:     { vi: 'không xe ẩn', en: 'no hidden cars' },
    solutionIs:   { vi: 'Lời giải', en: 'Solution' },
    forBudget:    { vi: 'cho', en: 'budget' },
    usedFor:      { vi: 'Dùng cho', en: 'Use for' },
    minBoard:     { vi: 'bàn tối thiểu', en: 'minimum board' },
    allCriteria:  { vi: '▸ cả', en: '▸ all' },
    criteria:     { vi: 'tiêu chí', en: 'criteria' },
    seeDetail:    { vi: '— xem chi tiết', en: '— see detail' },
    needWord:     { vi: 'cần', en: 'needs' },
    axisWord:     { vi: 'trục', en: 'axis' },
    closestTo:    { vi: 'Level này gần nhất với', en: 'This level is closest to' },
    offBy:        { vi: 'lệch', en: 'off by' },
    zeroMeansIn:  { vi: '0 là nằm trong mọi dải', en: '0 means inside every band' },
    measureFirst: { vi: 'bấm Đo / Muốn khó hơn để có số so sánh',
                    en: 'press Measure or Make it harder to get numbers to compare' },

    /* edit tab */
    colsRows:     { vi: 'cols × rows', en: 'cols × rows' },
    movesLabel:   { vi: 'moves', en: 'moves' },
    theme:        { vi: 'theme', en: 'theme' },
    brush:        { vi: 'Brush', en: 'Brush' },
    paintHidden:  { vi: 'tô kèm ẩn (?)', en: 'paint as hidden (?)' },
    paintHelp:    { vi: 'Click ô = tô. Right-click ô = bật/tắt ẩn.',
                    en: 'Click a cell to paint. Right-click to toggle hidden.' },
    gridWord:     { vi: 'Grid', en: 'Grid' },
    gridNote:     { vi: '(hàng trên = đỉnh cột, xe chèn vào đây)',
                    en: '(top row is the head of the column, where cars enter)' },
    padCar:       { vi: 'xe trên pad', en: 'car on the pad' },
    carCount:     { vi: 'Đếm xe', en: 'Car counts' },
    generate:     { vi: 'Generate', en: 'Generate' },
    colorCount:   { vi: 'số màu', en: 'colours' },
    straysWord:   { vi: 'strays', en: 'strays' },
    hiddenWord:   { vi: 'ẩn', en: 'hidden' },
    revInGrid:    { vi: 'xe ngược chiều nằm trong grid', en: 'wrong-way car sits in the grid' },
    genIntoLevel: { vi: 'Generate vào level này', en: 'Generate into this level' },
    genHelp:      { vi: 'Sinh từ bàn đã giải rồi chỉ đổi chỗ 2 xe, nên luôn hợp lệ. <b>strays</b> = số lần đổi chỗ, là dial độ khó chính. Muốn có <b>choice</b> thật thì đặt số màu &lt; số cột — khi đó 2 cột cùng màu và player phải chọn.',
                    en: 'Generated from a solved board by swapping pairs of cars, so it is always valid. <b>strays</b> is the number of swaps and the main difficulty dial. For real <b>choice</b>, set colours &lt; columns — then two columns share a colour and the player must pick.' },

    /* playtest tab */
    runPlaytest:  { vi: 'Chạy playtest', en: 'Run playtest' },
    runCount:     { vi: 'số lần', en: 'runs' },
    blindPlayer:  { vi: 'player không thấy xe ẩn', en: 'player cannot see hidden cars' },
    playtestHelp: { vi: 'Mỗi lần chơi được chạy với budget <b>không giới hạn</b> rồi ghi lại số move thực dùng. Một lượt chạy cho ra luôn cả đường cong budget → win rate, nên câu hỏi không còn là "50 move có ổn không" mà là "muốn win rate bao nhiêu thì đặt budget mấy".',
                    en: 'Every run is played with an <b>unlimited</b> budget and the moves actually used are recorded. One pass yields the whole budget-to-win-rate curve, so the question stops being "is 50 moves right?" and becomes "what budget buys the win rate you want?".' },
    budgetToWin:  { vi: 'Budget → win rate', en: 'Budget → win rate' },
    movesActually:{ vi: 'Số move thực dùng', en: 'Moves actually used' },
    conclusion:   { vi: 'Kết luận', en: 'Conclusion' },
    player:       { vi: 'player', en: 'player' },
    ceilingWord:  { vi: 'trần win', en: 'win ceiling' },
    winAtBudget:  { vi: 'win @ budget', en: 'win @ budget' },
    budgetFor:    { vi: 'budget', en: 'budget for' },
    unreachable:  { vi: 'không đạt', en: 'unreachable' },
    skillful:     { vi: 'giỏi', en: 'careful' },
    average:      { vi: 'trung bình', en: 'average' },
    histNote:     { vi: 'player trung bình. Cột đỏ = số ván cần nhiều move hơn budget hiện tại, tức là thua.',
                    en: 'average player. Red bars are runs needing more moves than the current budget — losses.' },
    curveNote:    { vi: 'kẻ vàng là budget đang đặt. Đọc: kéo dọc theo đường tới win rate muốn, rồi nhìn xuống trục để lấy budget.',
                    en: 'the amber line is the current budget. Read it by following a curve to the win rate you want, then down to the budget.' },
    noWins:       { vi: 'không có ván nào thắng', en: 'no run was won' },

    /* feel tab */
    preset:       { vi: 'preset', en: 'preset' },
    resetWord:    { vi: 'Reset', en: 'Reset' },
    useSprites:   { vi: 'dùng sprite xe (assets/shapes)', en: 'use car sprites (assets/shapes)' },
    feelJson:     { vi: 'Feel JSON', en: 'Feel JSON' },
    loadJson:     { vi: 'Load JSON này', en: 'Load this JSON' },
    copyWord:     { vi: 'Copy', en: 'Copy' },

    /* level set tab */
    analyzeAll:   { vi: 'Analyze cả set', en: 'Analyze whole set' },
    addLevel:     { vi: '+ Level', en: '+ Level' },
    duplicate:    { vi: 'Duplicate', en: 'Duplicate' },
    del:          { vi: 'Delete', en: 'Delete' },
    curveWord:    { vi: 'Curve', en: 'Curve' },
    exportWord:   { vi: 'Export', en: 'Export' },
    exportJson:   { vi: 'Xuất JSON set', en: 'Export set JSON' },
    downloadJson: { vi: 'Download .json', en: 'Download .json' },
    importJson:   { vi: 'Import từ textarea', en: 'Import from textarea' },

    /* game config (ConfigVersion 1) */
    gcHead:       { vi: 'Game JSON (ConfigVersion 1)', en: 'Game JSON (ConfigVersion 1)' },
    gcExtraLabel: { vi: 'Cột trống thêm', en: 'Extra columns' },
    gcHardLabel:  { vi: 'Ghi cứng bàn (Map)', en: 'Bake the board (Map)' },
    gcAttempts:   { vi: 'MaxAttempts', en: 'MaxAttempts' },
    gcSteps:      { vi: 'LockedShuffleSteps', en: 'LockedShuffleSteps' },
    gcOne:        { vi: 'Xuất level này', en: 'Export this level' },
    gcAll:        { vi: 'Xuất cả bộ', en: 'Export whole set' },
    gcDown:       { vi: 'Download level_N.json', en: 'Download level_N.json' },
    gcDownAll:    { vi: 'Download cả bộ', en: 'Download whole set' },
    gcImport:     { vi: 'Nhập config trong textarea', en: 'Import config from textarea' },
    gcHelp:       { vi: 'Config là <b>đơn xin sinh bàn</b> cho client: bàn <b>NumQueue × (NumPerRow + ExtraColumns)</b>, mỗi cột một kind, và client sinh lại tới khi lời giải rơi vào <b>[MinMove, MaxMove]</b>, tối đa MaxAttempts lần. Bật <b>ghi cứng bàn</b> nếu muốn ship đúng bàn đang chỉnh. <b>Cột trống thêm</b> là số cột client thêm để player có chỗ xoay xe — tool chưa mô phỏng ô trống nên chỉ ghi kèm, không đo.',
                    en: 'The config is a <b>generation brief</b> for the client: a <b>NumQueue × (NumPerRow + ExtraColumns)</b> board, one kind per column, regenerated until the solution lands inside <b>[MinMove, MaxMove]</b>, up to MaxAttempts tries. Turn on <b>bake the board</b> to ship exactly the board on screen. <b>Extra columns</b> are free columns the client adds for elbow room — this tool does not simulate empty slots, so the number is carried through, not measured.' },
    gcSolving:    { vi: 'Đang giải để lấy MinMove…', en: 'Solving for MinMove…' },
    gcNoConfig:   { vi: 'Textarea không có config nào (cần ConfigVersion hoặc NumQueue)',
                    en: 'No config in the textarea (needs ConfigVersion or NumQueue)' },

    /* column rules */
    colRules:     { vi: 'Luật cột', en: 'Column rules' },
    colRulesNote: { vi: '🔒 = cần clear bao nhiêu cột mới mở · ô màu = cột chỉ nhận đúng màu đó',
                    en: '🔒 = columns to clear before it opens · swatch = the only colour the column accepts' },
    colNone:      { vi: '— không', en: '— none' },

    /* modals */
    ok:           { vi: 'OK', en: 'OK' },
    close:        { vi: 'Đóng', en: 'Close' },
    cancel:       { vi: 'Huỷ', en: 'Cancel' },
    apply:        { vi: 'Áp dụng', en: 'Apply' },
    discard:      { vi: 'Bỏ', en: 'Discard' },
    rerollSeed:   { vi: 'Sinh lại (seed khác)', en: 'Regenerate (new seed)' },
    understood:   { vi: 'Tôi đã hiểu rồi', en: 'Got it' },
    later:        { vi: 'Để sau', en: 'Later' },
    guideTitle:   { vi: 'Bắt đầu ở đâu', en: 'Where to start' },
    switchSetQ:   { vi: 'Đổi sang bộ', en: 'Switch to campaign' },
    switchWarn:   { vi: 'Mỗi bộ là một curve khác nhau, nên <b>sẽ chơi lại từ level 1</b>. Giữ số level cũ sẽ rơi vào giữa ramp của bộ mới.',
                    en: 'Each campaign is a different curve, so <b>play restarts from level 1</b>. Keeping the old level number would drop you mid-ramp in the new one.' },
    switchGo:     { vi: 'Đổi và về level 1', en: 'Switch and restart at level 1' },
    stayOn:       { vi: 'Ở lại bộ', en: 'Stay on' },
    builtDone:    { vi: 'Đã sinh xong', en: 'Generated' },
    nearlyThere:  { vi: 'Gần đạt', en: 'Nearly there' },
    notGenerated: { vi: 'Không sinh được', en: 'Nothing generated' },
    someShort:    { vi: 'Xong, có level chưa đạt đủ', en: 'Done — some levels fall short' },
    levelsWord:   { vi: 'level', en: 'levels' },
    metAll:       { vi: 'đạt cả', en: 'meets all' },
    met:          { vi: 'đạt', en: 'meets' },

    mDiffLbl:     { vi: 'độ khó', en: 'difficulty' },
    mDepthLbl:    { vi: 'độ sâu', en: 'depth' },
    mWinC:        { vi: 'win — giỏi', en: 'win — careful' },
    mWinA:        { vi: 'win — trung bình', en: 'win — average' },
    mWinS:        { vi: 'win — ẩu', en: 'win — careless' },
    mColCol:      { vi: 'màu / cột', en: 'colours / cols' },
    mOutOfMoves:  { vi: 'hết moves', en: 'ran out' },

    buildingBoards:{ vi: 'Đang sinh bàn đạt tiêu chí', en: 'Generating a board that meets the criteria' },

    /* remaining */
    setPickWordGen40:   { vi: '40 level', en: '40 levels' },
    setPickWordDefault: { vi: 'Gốc', en: 'Original' },
    setPickWordEasy:    { vi: 'Dễ', en: 'Easy' },
    setPickWordMedium:  { vi: 'Trung bình', en: 'Medium' },
    setPickWordHard:    { vi: 'Khó', en: 'Hard' },
    brushSize:    { vi: 'Kích thước', en: 'Board size' },
    brushColors:  { vi: 'Số màu', en: 'Colours' },
    brushStrays:  { vi: 'Xe lạ', en: 'Strays' },
    brushHiddenL: { vi: 'Xe ẩn', en: 'Hidden cars' },
    revCarName:   { vi: 'xe ngược chiều', en: 'wrong-way car' },
    hiddenSuffix: { vi: ' (ẩn)', en: ' (hidden)' },
    optimalSuffix:{ vi: ' (tối ưu)', en: ' (optimal)' },
    running:      { vi: 'đang chạy…', en: 'running…' },
    runningOf:    { vi: 'đang chạy', en: 'running' },
    workerErr:    { vi: 'lỗi worker', en: 'worker error' },
    barsTitle:    { vi: 'tỉ lệ thắng ước lượng của ba hạng player',
                    en: 'estimated win rate for the three player profiles' },
    thisLevel:    { vi: 'level này', en: 'this level' },
    levelChanged: { vi: 'level đã đổi — analyze lại', en: 'level changed — analyze again' },
    invalidLevelHead: { vi: 'Level không hợp lệ:', en: 'Level is not valid:' },
    runAllForCurve:{ vi: 'chạy Analyze cả set để thấy curve', en: 'run Analyze whole set to see the curve' },
    setCurveLegend:{ vi: 'cột xanh = minMoves (scale {0}) · xanh lá = choice · đỏ = naiveWin · vàng = slack (scale 4x). Curve tốt: xanh lá đi lên, đỏ đi xuống, vàng phẳng quanh 1.5–2x.',
                     en: 'blue bars = minMoves (scale {0}) · green = choice · red = naiveWin · amber = slack (scale 4x). A good curve: green rising, red falling, amber flat around 1.5–2x.' },
    exportNote:   { vi: 'grid[col][row], row 0 = đỉnh cột. "REV" = xe ngược chiều. "?" = xe ẩn. lockedCols = cột khoá {col, need}, coloredCols = cột màu {col, color}. sets = 40 level + 4 bộ ngắn 10 level; đổi bộ thì chơi lại từ level 1.',
                    en: 'grid[col][row], row 0 is the head of the column. "REV" = wrong-way car, "?" = hidden car. lockedCols = locked columns {col, need}, coloredCols = coloured columns {col, color}. sets = the 40-level run plus four short 10-level campaigns; switching campaign restarts at level 1.' },

    tierShort:    { vi: 'bậc', en: 'step' },
    allNLevels:   { vi: 'cả {0} level', en: 'all {0} levels' },

    /* language */
    langLabel:    { vi: 'EN', en: 'VI' },
    langTitle:    { vi: 'Switch to English', en: 'Chuyển sang tiếng Việt' }
  };

  /* Whole-sentence templates with {0} placeholders. Composed messages must be
   * translated as sentences, not as the fragments they were concatenated from —
   * word order differs between the two languages and gluing translated pieces
   * produces nonsense. */
  var M = {
    /* game config + column rules */
    xGcExported:  { vi: 'Đã xuất {0} level', en: 'Exported {0} levels' },
    xGcImported:  { vi: 'Đã nhập {0} level', en: 'Imported {0} levels' },
    xPaintSwap:   { vi: 'đổi chỗ xe {0} ↔ {1} — tô là đổi chỗ, không ghi đè, để bàn luôn hợp lệ',
                    en: 'swapped {0} ↔ {1} — the brush swaps cars instead of overwriting, so the board stays legal' },
    xPaintRetint: { vi: 'bàn chưa có màu này nên nhường {0} xe {1} thành {2}',
                    en: 'the board had none of this colour, so {0} {1} cars became {2}' },
    xPaintFail:   { vi: 'không đủ xe để đưa màu {0} vào bàn này', en: 'not enough cars to bring {0} onto this board' },
    xPaintKept:   { vi: 'không đưa {0} vào được: mọi màu còn lại đang bị cột màu đòi. Bỏ luật cột màu trước.',
                    en: 'cannot bring {0} in: every remaining colour is claimed by a coloured column. Clear a column rule first.' },
    xGcSaved:     { vi: 'Đã tải {0}', en: 'Saved {0}' },
    xGcSaving:    { vi: 'Đang tải file {0}/{1}…', en: 'Saving file {0} of {1}…' },
    xGcBandMiss:  { vi: 'Level {0}: sinh {1} lần, lời giải {2} move — ngoài band [{3}, {4}]',
                    en: 'Level {0}: {1} tries, solution {2} moves — outside [{3}, {4}]' },
    xSealedTap:   { vi: 'Cột còn khoá, cần clear thêm {0} cột', en: 'Still locked — clear {0} more columns' },
    xColNeed:     { vi: 'cột {0}: mở sau khi clear {1} cột', en: 'column {0}: opens after {1} columns' },

    /* metric cards */
    mDiffNote:    { vi: '0 = ai cũng thắng, 100 = gần như thua', en: '0 = everyone wins, 100 = almost nobody does' },
    mDepthNote:   { vi: '% lượt có quyết định thật', en: '% of turns with a real decision' },
    mMistake:     { vi: 'lỗi tay {0}%', en: '{0}% mistake rate' },
    mSlackNote:   { vi: 'budget / lời giải thực tế', en: 'budget / practical solution' },
    mStrayNote:   { vi: 'xe không nằm đúng cột màu của nó', en: 'cars not in their colour\'s column' },
    mColShare:    { vi: 'có cột trùng màu → có lựa chọn', en: 'columns share a colour → real choice' },
    mColOne:      { vi: 'mỗi màu 1 cột → chuỗi ép', en: 'one colour per column → forced chain' },
    mCars:        { vi: '{0} xe', en: '{0} cars' },
    mHiddenN:     { vi: '{0} xe ẩn', en: '{0} hidden cars' },
    mNoHidden:    { vi: 'không xe ẩn', en: 'no hidden cars' },
    mNotMeasured: { vi: 'bấm Analyze ở tab Tune', en: 'press Analyze on the Tune tab' },
    mAnalysis:    { vi: 'phân tích', en: 'analysis' },
    mOptimal:     { vi: 'tối ưu', en: 'optimal' },
    mGreedyMaybe: { vi: 'greedy (chưa chắc tối ưu)', en: 'greedy (may not be optimal)' },
    mIdaOptimal:  { vi: 'IDA* tối ưu', en: 'IDA* optimum' },
    mGreedyUpper: { vi: 'greedy upper bound', en: 'greedy upper bound' },
    mBudgetOver:  { vi: 'budget / minMoves', en: 'budget / minMoves' },
    mRealDecide:  { vi: 'quyết định thật', en: 'real decisions' },
    mDumpNote:    { vi: 'đổ bừa', en: 'forced dump' },
    mBranchNote:  { vi: 'cột hợp lệ / lượt', en: 'legal columns per turn' },
    mTwoPlus:     { vi: '≥2 cột nhận được', en: '≥2 columns accept it' },
    mGreedyPlayer:{ vi: 'player bấm greedy', en: 'greedy player' },
    mPlayoutN:    { vi: '{0} playout', en: '{0} playouts' },
    mLostBudget:  { vi: 'player thua vì hết move', en: 'player lost to the budget' },
    mWhenWon:     { vi: 'khi thắng', en: 'when won' },
    mTrapNote:    { vi: 'move phí khi tap sai ({0} mẫu)', en: 'moves wasted per wrong tap ({0} samples)' },
    mColsOf:      { vi: '{0} / {1}', en: '{0} / {1}' },
    mNoChoice:    { vi: 'không có lựa chọn', en: 'no choice' },

    /* move log */
    logHead:      { vi: 'moves {0}/{1}   pad: {2}   xong {3}/{4} cột',
                    en: 'moves {0}/{1}   pad: {2}   {3}/{4} columns cleared' },
    logTap:       { vi: 'tap cột {0} — chèn {1}, văng ra {2}', en: 'tapped column {0} — inserted {1}, ejected {2}' },
    logDone:      { vi: '  ✅ cột {0}', en: '  ✅ column {0}' },
    logSort:      { vi: '  ↧ auto-sort cột {0}', en: '  ↧ auto-sorted column {0}' },
    logGood:      { vi: 'cột nhận được xe trên pad (theo mắt player): {0}',
                    en: 'columns that accept the pad car (as the player sees it): {0}' },
    logNoGood:    { vi: 'không có → phải đổ bừa', en: 'none → forced dump' },
    logShapes:    { vi: '{0} kiểu dáng xe đã nạp', en: '{0} car shapes loaded' },
    logInvalid:   { vi: 'level chưa hợp lệ', en: 'level is not valid' },
    logHint:      { vi: 'hint: cột {0}, còn {1} move tối ưu', en: 'hint: column {0}, {1} optimal moves left' },
    logHintGreedy:{ vi: 'hint (greedy, solver hết node): cột {0}', en: 'hint (greedy, solver out of nodes): column {0}' },
    logNoSol:     { vi: 'không tìm được lời giải từ thế này', en: 'no solution found from here' },
    logNoAuto:    { vi: 'không có lời giải để autoplay', en: 'no solution to autoplay' },
    logContinue:  { vi: '+{0} move (lần continue {1}/{2})', en: '+{0} moves (continue {1}/{2})' },
    logKept:      { vi: 'đã giữ thay đổi', en: 'change kept' },
    logReverted:  { vi: 'đã hoàn tác: {0}', en: 'reverted: {0}' },
    logApplied:   { vi: 'đã áp dụng: {0}', en: 'applied: {0}' },
    logSetSwitch: { vi: 'bộ {0} ({1}) — về level 1', en: 'campaign {0} ({1}) — back to level 1' },
    logCancelled: { vi: 'đã huỷ áp dụng {0}', en: 'cancelled applying {0}' },
    logCopied:    { vi: 'đã copy nhật ký ({0} lượt)', en: 'log copied ({0} runs)' },
    logTplLoaded: { vi: 'đã nạp template', en: 'templates loaded' },
    logTplReset:  { vi: 'template về mặc định', en: 'templates reset to default' },
    logTierBuilt: { vi: 'bậc {0} · bàn {1} · budget {2} · đạt {3}/{4} tiêu chí',
                    en: 'step {0} · board {1} · budget {2} · meets {3}/{4} criteria' },
    logTierApplied:{ vi: '{0}: áp dụng cho {1} level', en: '{0}: applied to {1} levels' },
    logTplResult: { vi: '{0}: {1}/{2} tiêu chí, bàn {3}, budget {4}',
                    en: '{0}: {1}/{2} criteria, board {3}, budget {4}' },
    logBudgetSet: { vi: 'budget → {0} (win trung bình {1})', en: 'budget → {0} (average win {1})' },
    logNoOpt:     { vi: 'không đo được lời giải để đặt budget', en: 'could not measure a solution to set the budget from' },
    logAnalyzeFirst:{ vi: 'analyze trước đã', en: 'analyze first' },
    logWorkerFail:{ vi: 'worker lỗi ({0}), chạy trên luồng chính', en: 'worker failed ({0}), running on the main thread' },
    logGen:       { vi: 'generated: minMoves {0}, budget {1}', en: 'generated: minMoves {0}, budget {1}' },
    logGenNoMin:  { vi: 'generated (không đo được minMoves)', en: 'generated (minMoves not measured)' },

    /* result screen */
    resWinSub:    { vi: '{0}/{1} move · thừa {2}', en: '{0}/{1} moves · {2} spare' },
    resLoseSub:   { vi: 'xong {0}/{1} cột · dùng {2} move', en: '{0}/{1} columns cleared · {2} moves used' },
    resNextLevel: { vi: 'Level {0} →', en: 'Level {0} →' },
    resTooLoose:  { vi: 'Còn thừa <b>{0}/{1}</b> move. Budget đang rộng quá — chạy Playtest rồi đặt lại theo mốc win 75%.',
                    en: '<b>{0}/{1}</b> moves unspent. The budget is too loose — run Playtest and reset it at the 75% win mark.' },
    resTight:     { vi: 'Thắng sát nút ({0} move dư). Budget đang chặt — kiểm tra player ẩu có qua nổi không.',
                    en: 'Won by a hair ({0} spare). The budget is tight — check whether the careless player can clear it.' },
    resSellMoment:{ vi: 'Chỉ còn thiếu <b>{0} move</b> là xong. Đây đúng là khoảnh khắc bán booster — player đã đầu tư cả ván và chỉ hụt một chút.',
                    en: 'Only <b>{0} moves</b> short. This is the booster moment — the player invested a whole run and missed by a little.' },
    resTooFar:    { vi: 'Còn cần <b>{0} move{1}</b> nữa mới xong, nên +{2} move không đủ cứu. Thua từ quá sớm — không phải khoảnh khắc bán booster.',
                    en: 'Still <b>{0} moves{1}</b> from finishing, so +{2} cannot rescue it. Lost too early — not a booster moment.' },
    resNoContinue:{ vi: 'Đã dùng hết {0} lần continue trong ván này.', en: 'All {0} continues already used this run.' },
    resUnknown:   { vi: 'Solver không đo được trong ngân sách tìm kiếm nên chưa biết cần thêm bao nhiêu move. <b>Không có nghĩa là thế cờ chết</b> — game này không có ngõ cụt, mọi thế đều giải được.',
                    en: 'The solver ran out of search budget, so how many more moves are needed is unknown. <b>That does not mean the position is dead</b> — this game has no dead ends; every position is solvable.' },

    /* verdicts */
    vSlackLoose:  { vi: 'slack {0}x — budget quá thoải mái, move count không tạo áp lực. Đặt {1} thay vì {2}.',
                    en: 'slack {0}x — the budget is too generous and the move count applies no pressure. Set {1} instead of {2}.' },
    vSlackTight:  { vi: 'slack {0}x — gần như phải đi tối ưu tuyệt đối mới thắng.',
                    en: 'slack {0}x — winning demands very nearly perfect play.' },
    vSlackOk:     { vi: 'slack {0}x hợp lý.', en: 'slack {0}x is reasonable.' },
    vChoiceLow:   { vi: 'choice {0} — chuỗi cưỡng bức, player chỉ đi theo xe văng ra. Thêm 2 cột cùng màu, hoặc cột có ≥2 xe lạ.',
                    en: 'choice {0} — a forced chain; the player just follows the ejected car. Add two columns of one colour, or columns holding 2+ strays.' },
    vChoiceMid:   { vi: 'choice {0} — vẫn còn ít quyết định thật.', en: 'choice {0} — still few real decisions.' },
    vChoiceOk:    { vi: 'choice {0} — có puzzle thật.', en: 'choice {0} — there is a real puzzle here.' },
    vNaiveHigh:   { vi: 'naiveWin {0} — player bấm bừa cũng thắng.', en: 'naiveWin {0} — even careless tapping wins.' },
    vNaiveLow:    { vi: 'naiveWin {0} — có thể quá gắt cho level đầu.', en: 'naiveWin {0} — possibly too harsh for an early level.' },
    vNaiveOk:     { vi: 'naiveWin {0} — có tỉ lệ fail thật.', en: 'naiveWin {0} — a real failure rate.' },
    vHiddenMuch:  { vi: 'xe ẩn chiếm {0} bàn — player mất khả năng lập kế hoạch.',
                    en: 'hidden cars cover {0} of the board — the player cannot plan.' },
    vCapped:      { vi: 'solver hết node cap, minMoves là chặn trên từ greedy chứ chưa chắc tối ưu.',
                    en: 'the solver hit its node cap; minMoves is a greedy upper bound, not a proven optimum.' },
    vUnsolvable:  { vi: 'Level không giải được.', en: 'This level cannot be solved.' },

    /* playtest conclusions */
    pWinTooHigh:  { vi: 'Budget {0} cho win {1} — move count không phải là cơ chế ở level này. Muốn 75% thì đặt {2}.',
                    en: 'Budget {0} yields a {1} win rate — the move count is not a mechanic here. For 75%, set {2}.' },
    pWinTooLow:   { vi: 'Win chỉ {0} — gắt. Budget cho 75% là {1}.',
                    en: 'Only {0} win — harsh. The budget for 75% is {1}.' },
    pWinOk:       { vi: 'Win {0} ở budget {1} — vùng hợp lý.', en: 'Win {0} at budget {1} — a reasonable zone.' },
    pNoConverge:  { vi: '{0} lượt chơi không về đích dù budget vô hạn. KHÔNG phải thế cờ chết — game này không có ngõ cụt, mọi thế đều giải được. Đây là player bấm theo bản năng bị lặp vòng: đẩy xe qua lại giữa hai cột mà không tiến. Trung bình kẹt ở {1}/{2} cột. Level dễ gây lặp vòng thì player thật sẽ thấy bế tắc dù vẫn còn cửa.',
                    en: '{0} of runs never finish even with an unlimited budget. NOT dead positions — this game has no dead ends, every position is solvable. This is the instinctive player cycling: shuffling cars between two columns without progress. On average stuck at {1}/{2} columns. A level that induces cycling will feel like a dead end to real players even though a win is still available.' },
    pSpread:      { vi: 'Chênh lệch giỏi vs ẩu: {0}{1}', en: 'Careful vs careless gap: {0}{1}' },
    pSkillPays:   { vi: ' — kỹ năng có thưởng.', en: ' — skill is rewarded.' },
    pSkillFlat:   { vi: ' — kỹ năng gần như không ăn thua.', en: ' — skill barely matters.' },
    pDumps:       { vi: 'Trung bình {0} lượt/ván không có cột nào nhận được xe trên pad (phải đổ bừa), và {1} cột nhận được mỗi lượt.',
                    en: 'On average {0} turns per run have no column that accepts the pad car (a forced dump), and {1} columns accept it per turn.' },

    /* curve warnings */
    wTrend:       { vi: 'Xu hướng cả chuỗi là <b>{0} bậc/level</b> — game không khó dần. Chỗ nghỉ chủ ý thì tốt, nhưng trung bình phải đi lên.',
                    en: 'The trend across the run is <b>{0} steps per level</b> — the game does not get harder. Intended breathers are fine, but the average must climb.' },
    wJump:        { vi: 'Level {0} → {1} nhảy <b>{2} bậc</b>. Quá 2 bậc thường thành tường chắn.',
                    en: 'Level {0} → {1} jumps <b>{2} steps</b>. More than two usually becomes a wall.' },
    wDrop:        { vi: 'Level {0} tụt <b>{1} bậc</b> so với level {2} mà không khai là chỗ nghỉ — sụt sâu thế player đọc thành game hết ý tưởng.',
                    en: 'Level {0} drops <b>{1} steps</b> from level {2} without being declared a breather — a fall that deep reads as the game running out of ideas.' },
    wEndPeak:     { vi: 'Level cuối ({0}) <b>chính là đỉnh</b>. Trừ khi bộ này cố tình lọc player, nên kết ở một chỗ nghỉ để player bước sang level sau với cảm giác thành thạo.',
                    en: 'The last level ({0}) <b>is the peak</b>. Unless this campaign means to filter, end on a breather so the player moves on feeling capable.' },
    wFlatSet:     { vi: 'Cả set cùng <b>một bậc</b> sẽ làm curve phẳng — player không thấy game khó dần. Thường nên chia khoảng, ví dụ bậc 1–2 cho level 1–8, bậc 3–5 cho 9–25.',
                    en: 'One step for the whole set flattens the curve — the player never feels it getting harder. Split by range instead, e.g. steps 1–2 for levels 1–8, 3–5 for 9–25.' },

    /* dialogs */
    dGrowBoard:   { vi: 'Bàn {0} nhỏ hơn mức tối thiểu {1} của bậc, nên sẽ mở rộng lên <b>{2}</b>. Bàn ngắn thì lời giải ngắn, không đủ số nước để player kịp thua.',
                    en: 'Board {0} is below this step\'s minimum of {1}, so it will grow to <b>{2}</b>. A short board has a short solution and leaves too few moves for the player to lose in.' },
    dPerLevelNote:{ vi: 'Mỗi level được sinh và playtest riêng, giữ nguyên kích thước bàn của nó (chỉ mở rộng nếu nhỏ hơn mức tối thiểu của bậc). Chạy ngoài luồng chính nên UI không đứng.',
                    en: 'Each level is generated and playtested on its own and keeps its board size unless the step\'s minimum forces a grow. It runs off the main thread, so the UI stays live.' },
    dNothingValid:{ vi: 'Không tạo được bàn hợp lệ nào cho {0}.', en: 'No valid board could be generated for {0}.' },
    dTryHarder:   { vi: 'Level chưa đạt: đổi seed, hoặc nới dải của bậc trong phần Sửa template.',
                    en: 'Levels that fell short: change the seed, or widen the step\'s bands under Edit templates.' },
    dStepsTried:  { vi: 'Đã thử hết {0} bước mà vẫn lệch. Tăng seed, hoặc nới dải của bậc trong phần Sửa template.',
                    en: 'All {0} steps tried and still off. Change the seed, or widen the step\'s bands under Edit templates.' },
    dApplyN:      { vi: 'Áp dụng cho {0} level', en: 'Apply to {0} levels' },
    dGenDone:     { vi: 'Đã sinh xong {0} level', en: 'Generated {0} levels' },
    dNoValidLv:   { vi: 'Khoảng đã chọn không có level nào hợp lệ.', en: 'The chosen range contains no valid level.' },
    dInvalidNow:  { vi: 'Level hiện tại không hợp lệ.', en: 'The current level is not valid.' },
    dClearLogQ:   { vi: 'Xoá nhật ký?', en: 'Clear the log?' },
    dClearLogB:   { vi: 'Xoá toàn bộ {0} lượt đã ghi. Bậc đã chốt vẫn giữ.',
                    en: 'Deletes all {0} recorded runs. Signed-off steps are kept.' },
    dDelete:      { vi: 'Xoá', en: 'Delete' },
    dKeep:        { vi: 'Thôi', en: 'Keep' },
    dSignedOff:   { vi: 'Đã chốt bậc {0}', en: 'Step {0} signed off' },
    dSignedOffB:  { vi: 'Level {0} = <b>bậc {1}</b>.', en: 'Level {0} = <b>step {1}</b>.' },
    dSignedFor:   { vi: 'Đã chốt bậc {0} cho level {1}', en: 'Step {0} signed off for level {1}' },
    dJsonErr:     { vi: 'JSON lỗi', en: 'JSON error' },
    dImportErr:   { vi: 'Import lỗi', en: 'Import error' },
    dNoLevels:    { vi: 'Không thấy mảng <b>levels</b> trong JSON.', en: 'No <b>levels</b> array in the JSON.' },
    dTplJsonErr:  { vi: 'Template JSON lỗi', en: 'Template JSON error' },
    dFeelJsonErr: { vi: 'Feel JSON lỗi', en: 'Feel JSON error' },
    dStepOf:      { vi: 'bước {0}/{1} · {2} · bàn thử {3}/{4}', en: 'stage {0}/{1} · {2} · board {3}/{4}' },
    dLevelOf:     { vi: 'level {0} ({1}/{2}) · {3}', en: 'level {0} ({1}/{2}) · {3}' },
    dNoBoardAt:   { vi: 'Không sinh được bàn hợp lệ ở bậc {0}.', en: 'No valid board could be generated at step {0}.' },

    /* misc */
    xTierSpanWide:{ vi: 'budget rộng', en: 'wide budget' },
    xStepSpan:    { vi: 'bậc {0}→{1}', en: 'step {0}→{1}' },
    xStrayCell:   { vi: '{0} — xe lạ, không thuộc cột này', en: '{0} — a stray, does not belong to this column' },
    xHiddenCell:  { vi: 'xe ẩn', en: 'hidden car' },
    xRevCell:     { vi: 'xe ngược chiều', en: 'wrong-way car' },
    xColOfN:      { vi: '{0} màu / {1} cột', en: '{0} colours / {1} columns' },
    xSampleFacts: { vi: 'Bàn mẫu {0}×{1}: <b>{2}</b> xe lạ, {3}{4}.<br>Dùng cho: {5} · bàn tối thiểu {6}×{7}',
                    en: 'Sample board {0}×{1}: <b>{2}</b> strays, {3}{4}.<br>Use for: {5} · minimum board {6}×{7}' },
    xSolFor:      { vi: 'Lời giải <b>{0}</b> move, cho <b>{1}</b>', en: 'Solution <b>{0}</b> moves, budget <b>{1}</b>' },
    xClosest:     { vi: 'Level này gần nhất với <b>{0}</b> (lệch {1} — 0 là nằm trong mọi dải)',
                    en: 'This level is closest to <b>{0}</b> (off by {1} — 0 means inside every band)' },
    xEstimate:    { vi: 'ước lượng: win TB {0}–{1}% · ẩu {2}–{3}%',
                    en: 'estimate: win avg {0}–{1}% · careless {2}–{3}%' },
    xLevelStep:   { vi: 'Level <b>{0}</b> · Bậc <b>{1}</b> · {2}', en: 'Level <b>{0}</b> · Step <b>{1}</b> · {2}' },
    xLevelNoStep: { vi: 'Level <b>{0}</b> · chưa rõ bậc', en: 'Level <b>{0}</b> · step unknown' },
    xAfterApply:  { vi: 'sau khi áp dụng: win giỏi {0} · trung bình {1} · ẩu {2} · slack {3} · budget {4}',
                    en: 'after applying: win careful {0} · average {1} · careless {2} · slack {3} · budget {4}' },
    xSortHint:    { vi: 'Xếp theo tác động ĐO ĐƯỢC lên độ khó, không phải phỏng đoán — mỗi phương án được playtest thật. Δkhó là tỉ lệ thua, Δsâu là số quyết định. Hai trục này đi ngược nhau khá thường xuyên.',
                    en: 'Ranked by MEASURED effect on difficulty, not guesswork — every option is really playtested. Δhard is the loss rate, Δdeep is the number of decisions. The two often move in opposite directions.' },
    xNoOption:    { vi: 'không có phương án nào áp dụng được', en: 'no option can be applied' },
    xRunning:     { vi: 'đang playtest từng phương án…', en: 'playtesting each option…' },
    xHard:        { vi: 'khó', en: 'hard' },
    xDeep:        { vi: 'sâu', en: 'deep' },
    xNotMeasured: { vi: 'chưa analyze', en: 'not analyzed' },
    xSolLen:      { vi: 'dài {0} move{1}\ncột: {2}\nnodes {3}, {4}ms',
                    en: 'length {0} moves{1}\ncolumns: {2}\nnodes {3}, {4}ms' },
    xNoSolNodes:  { vi: 'không tìm được lời giải (nodes {0})', en: 'no solution found (nodes {0})' },
    xValidOk:     { vi: '✔ hợp lệ — {0} xe = {1}×{2}+1, xe kết thúc trên pad có thể là: {3}',
                    en: '✔ valid — {0} cars = {1}×{2}+1; the car left on the pad can be: {3}' },
    xValidRule:   { vi: 'quy tắc: tổng xe = cols×rows+1; mỗi màu phải đủ bội số của rows ({0}) sau khi để lại đúng 1 xe trên pad.',
                    en: 'rule: total cars = cols×rows+1, and every colour must be a multiple of rows ({0}) once exactly one car is left on the pad.' },
    xCols:        { vi: '{0} cột', en: '{0} cols' },
    xTryPlay:     { vi: '▶ Chơi thử', en: '▶ Try it' },
    xKeep:        { vi: '✔ Giữ', en: '✔ Keep' },
    xUndoN:       { vi: '↶ Hoàn tác ({0})', en: '↶ Undo ({0})' },
    xTrying:      { vi: 'Đang thử: <b>{0}</b>', en: 'Trying: <b>{0}</b>' },
    xModeTest:    { vi: 'Đang ở <b>Test</b> — chỉ chơi và đọc chỉ số. Không sửa được gì.',
                    en: 'In <b>Test</b> — play and read the numbers only. Nothing here can edit.' },
    xModePlaytune:{ vi: 'Đang ở <b>Chơi & cân</b> — chơi rồi nâng/hạ bậc ngay tại bàn. Mọi lượt được ghi vào tab <b>Nhật ký</b>.',
                    en: 'In <b>Play & tune</b> — play, then raise or lower the step at the board. Every run lands in the <b>Journal</b> tab.' },
    xModeDesign:  { vi: 'Đang ở <b>Level Design</b> — đủ 6 tab: Tune (thang 10 bậc + gợi ý), Edit (vẽ lưới), Feel (animation, kiểu dáng xe).',
                    en: 'In <b>Level Design</b> — all six tabs: Tune (the 10-step ladder plus suggestions), Edit (draw the grid), Feel (animation, car shapes).' },
    xGuide:       { vi: '<b>Bộ 40 level</b> mở sẵn — xe ẩn từ level 9, cột màu từ 21, cột khoá từ 31. Cạnh nó là 4 bộ ngắn 10 level (Gốc · Dễ · Trung bình · Khó) để so curve. Đổi bộ là chơi lại từ level 1.',
                    en: '<b>The 40-level run</b> opens first — hidden cars from level 9, coloured columns from 21, locked columns from 31. Beside it sit four short 10-level campaigns (Original · Easy · Medium · Hard) for comparing curves. Switching restarts from level 1.' },
    xGuideTest:   { vi: 'Chơi và đọc chỉ số. Không sửa được gì, kể cả vô tình.',
                    en: 'Play and read the numbers. Nothing can edit, not even by accident.' },
    xGuidePlay:   { vi: 'Chơi rồi nâng/hạ bậc ngay tại bàn. Mọi lượt vào tab Nhật ký.',
                    en: 'Play, then raise or lower the step at the board. Every run goes to the Journal tab.' },
    xGuideDesign: { vi: 'Sửa lưới, thang 10 bậc, game feel, export.',
                    en: 'Edit the grid, the 10-step ladder, game feel, export.' },
    xGuideTab:    { vi: 'Tab <b>Độ khó</b> mở sẵn — biểu đồ các bộ và từng level. Mọi con số đều có dấu',
                    en: 'The <b>Difficulty</b> tab opens first — charts for every campaign and every level. Every number carries a' },
    xGuideTabB:   { vi: 'bấm được.', en: 'you can click.' }
  };

  var listeners = [];

  /* m('key', a, b) fills {0} {1} in the template for the active language. */
  function m(key) {
    var e = M[key];
    var str = e ? (e[lang] != null ? e[lang] : (e.en != null ? e.en : e.vi)) : key;
    var args = Array.prototype.slice.call(arguments, 1);
    return str.replace(/\{(\d+)\}/g, function (_, i) {
      return args[+i] != null ? args[+i] : '';
    });
  }

  function t(key) {
    var e = D[key];
    if (!e) return key;
    return e[lang] != null ? e[lang] : (e.en != null ? e.en : e.vi);
  }

  /* For {vi, en} pairs held by other modules. */
  function L(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    if (obj[lang] != null) return obj[lang];
    return obj.en != null ? obj.en : (obj.vi != null ? obj.vi : '');
  }

  function apply(root) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n]'), function (n) {
      n.textContent = t(n.dataset.i18n);
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n-html]'), function (n) {
      n.innerHTML = t(n.dataset.i18nHtml);
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n-title]'), function (n) {
      n.title = t(n.dataset.i18nTitle);
    });
    document.documentElement.lang = lang;
  }

  function set(next) {
    if (next !== 'vi' && next !== 'en') return;
    lang = next;
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply();
    listeners.forEach(function (fn) { fn(lang); });
  }

  function onChange(fn) { listeners.push(fn); }
  function get() { return lang; }

  global.I18N = { t: t, m: m, L: L, apply: apply, set: set, get: get, onChange: onChange,
                  DICT: D, MSG: M };
})(typeof self !== 'undefined' ? self : this);
