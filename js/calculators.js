// ═══════════════════════════════════════════════════════════════
// calculators.js — Keno Vault Calculation Engine
// Handles: FIRE, Tax-Drag, Depreciation, Debt Paydown, NW Score
// ═══════════════════════════════════════════════════════════════

const Calculators = (() => {

  // ── Compound Interest ──────────────────────────────────────────
  function compoundInterest(principal, ratePercent, years) {
    if (!principal || !ratePercent || !years) return { fv: 0, interest: 0 };
    const fv = principal * Math.pow(1 + ratePercent / 100, years);
    return { fv, interest: fv - principal, multiplier: fv / principal };
  }

  // ── Net Worth Score (0–100) ────────────────────────────────────
  function netWorthScore(assets) {
    let score = 0;
    let totalAssets = 0, totalLiabilities = 0, liquid = 0, investments = 0;
    assets.forEach(a => {
      if (a.cat === 'liability') totalLiabilities += a.value;
      else {
        totalAssets += a.value;
        if (a.cat === 'cash') liquid += a.value;
        if (a.cat === 'investment') investments += a.value;
      }
    });
    const netWorth = totalAssets - totalLiabilities;
    const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 1;
    const liquidRatio = totalAssets > 0 ? liquid / totalAssets : 0;
    const investRatio = totalAssets > 0 ? investments / totalAssets : 0;

    // Debt-to-asset ratio (0–30 pts)
    if (debtRatio < 0.1) score += 30;
    else if (debtRatio < 0.3) score += 22;
    else if (debtRatio < 0.5) score += 14;
    else if (debtRatio < 0.7) score += 6;

    // Liquid buffer (0–20 pts)
    if (liquidRatio >= 0.15 && liquidRatio <= 0.3) score += 20;
    else if (liquidRatio >= 0.1) score += 14;
    else if (liquidRatio >= 0.05) score += 8;

    // Investment ratio (0–25 pts)
    if (investRatio >= 0.5) score += 25;
    else if (investRatio >= 0.3) score += 18;
    else if (investRatio >= 0.15) score += 10;
    else if (investRatio > 0) score += 5;

    // Diversification (0–15 pts)
    const categories = new Set(assets.map(a => a.cat)).size;
    score += Math.min(categories * 4, 15);

    // Positive net worth (0–10 pts)
    if (netWorth > 0) score += 10;

    return {
      score: Math.min(Math.round(score), 100),
      debtRatio: (debtRatio * 100).toFixed(1),
      liquidRatio: (liquidRatio * 100).toFixed(1),
      investRatio: (investRatio * 100).toFixed(1),
      label: score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Work',
      color: score >= 80 ? '#34d399' : score >= 60 ? '#f4c553' : score >= 40 ? '#f97316' : '#f87171',
    };
  }

  // ── Depreciation Engine ────────────────────────────────────────
  function straightLineDepreciation(cost, salvageValue, usefulLifeYears) {
    const annualDep = (cost - salvageValue) / usefulLifeYears;
    const schedule  = [];
    let bookValue   = cost;
    for (let yr = 1; yr <= usefulLifeYears; yr++) {
      bookValue -= annualDep;
      schedule.push({
        year: yr, depreciation: annualDep,
        bookValue: Math.max(bookValue, salvageValue),
        accumulated: annualDep * yr,
      });
    }
    return { annualDep, schedule, monthlyDep: annualDep / 12 };
  }

  function reducingBalanceDepreciation(cost, ratePercent, years) {
    const schedule = [];
    let bookValue  = cost;
    for (let yr = 1; yr <= years; yr++) {
      const dep = bookValue * (ratePercent / 100);
      bookValue -= dep;
      schedule.push({ year: yr, depreciation: dep, bookValue, rate: ratePercent });
    }
    return { schedule, finalValue: bookValue, totalDepreciation: cost - bookValue };
  }

  function currentBookValue(asset) {
    if (!asset.depreciationType || !asset.depreciationStart) return asset.value;
    const monthsElapsed = Math.max(0,
      (Date.now() - new Date(asset.depreciationStart).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    );
    if (asset.depreciationType === 'straight-line') {
      const { monthlyDep } = straightLineDepreciation(
        asset.originalCost || asset.value, asset.salvageValue || 0, asset.usefulLife || 5
      );
      return Math.max(asset.salvageValue || 0, (asset.originalCost || asset.value) - (monthlyDep * monthsElapsed));
    }
    if (asset.depreciationType === 'reducing-balance') {
      const monthlyRate = (asset.depreciationRate || 20) / 100 / 12;
      return (asset.originalCost || asset.value) * Math.pow(1 - monthlyRate, monthsElapsed);
    }
    return asset.value;
  }

  // ── FIRE / Retirement Simulator ────────────────────────────────
  function fireSimulation({
    currentAge        = 30,
    retirementAge     = 55,
    currentNetWorth   = 0,
    monthlySavings    = 100000,
    annualReturnRate  = 10,
    inflationRate     = 18,
    annualExpenses    = 2400000,
  }) {
    const years = retirementAge - currentAge;
    const realReturn = ((1 + annualReturnRate / 100) / (1 + inflationRate / 100) - 1) * 100;
    const monthlyReturn = realReturn / 100 / 12;
    const months = years * 12;

    // FV of current net worth
    const fvCurrentNW = currentNetWorth * Math.pow(1 + realReturn / 100, years);

    // FV of monthly contributions (annuity)
    const fvContributions = monthlyReturn > 0
      ? monthlySavings * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn)
      : monthlySavings * months;

    const projectedNW = fvCurrentNW + fvContributions;

    // FI Number (25x rule — uses today's expenses, in today's naira)
    const fiNumber = annualExpenses * 25;
    const isFIReady = projectedNW >= fiNumber;

    // Year-by-year trajectory
    const trajectory = [];
    let nw = currentNetWorth;
    for (let y = 0; y <= years; y++) {
      trajectory.push({
        age: currentAge + y,
        year: new Date().getFullYear() + y,
        netWorth: Math.round(nw),
        fiNumber: Math.round(fiNumber),
      });
      nw = nw * (1 + realReturn / 100) + monthlySavings * 12;
    }

    return {
      projectedNW: Math.round(projectedNW),
      fiNumber: Math.round(fiNumber),
      isFIReady,
      shortfall: Math.max(0, fiNumber - projectedNW),
      surplus: Math.max(0, projectedNW - fiNumber),
      realReturnRate: realReturn.toFixed(2),
      trajectory,
      yearsToRetirement: years,
    };
  }

  // ── Debt Paydown Optimizer ─────────────────────────────────────
  function debtPaydown(debts, extraMonthlyPayment = 0, method = 'avalanche') {
    // debts: [{ name, balance, minPayment, interestRate }]
    let debtList = debts.map(d => ({
      ...d,
      originalBalance: d.balance,
      payoffMonth: null,
      interestAccrued: 0,
    }));
    const totalMinPayment = debtList.reduce((s, d) => s + d.minPayment, 0);
    const totalPayment    = totalMinPayment + extraMonthlyPayment;

    // Sort by method
    if (method === 'avalanche') {
      debtList.sort((a, b) => b.interestRate - a.interestRate); // highest rate first
    } else {
      debtList.sort((a, b) => a.balance - b.balance); // lowest balance first
    }

    const payoffOrder = [];
    const timeline = [];
    let month = 0;
    let totalInterestPaid = 0;

    while (debtList.some(d => d.balance > 0) && month < 600) {
      month++;
      let remaining = totalPayment;

      // Pay minimums first
      debtList.forEach(d => {
        if (d.balance <= 0) return;
        const interest = d.balance * (d.interestRate / 100 / 12);
        totalInterestPaid += interest;
        d.interestAccrued += interest;
        d.balance += interest;
        const payment = Math.min(d.minPayment, d.balance);
        d.balance -= payment;
        remaining  -= payment;
      });

      // Dump extra payment on priority debt
      for (let d of debtList) {
        if (d.balance <= 0 || remaining <= 0) continue;
        const payment = Math.min(remaining, d.balance);
        d.balance -= payment;
        remaining  -= payment;
      }

      // Record debts paid off this month
      debtList.forEach(d => {
        if (d.balance <= 0.01 && d.payoffMonth === null) {
          d.payoffMonth = month;
          d.balance = 0;
          payoffOrder.push({ name: d.name, month });
        }
      });

      const totalRemaining = debtList.reduce((s, d) => s + Math.max(0, d.balance), 0);
      timeline.push({ month, totalDebt: Math.round(totalRemaining), totalInterestPaid: Math.round(totalInterestPaid) });

      if (totalRemaining <= 0.01) break;
    }

    // Per-debt summary
    const perDebt = debtList.map(d => ({
      name: d.name,
      originalBalance: d.originalBalance,
      interestRate: d.interestRate,
      minPayment: d.minPayment,
      payoffMonth: d.payoffMonth || month,
      totalInterestPaid: Math.round(d.interestAccrued || 0),
    }));

    return {
      months: month,
      years: (month / 12).toFixed(1),
      totalInterestPaid: Math.round(totalInterestPaid),
      totalMinPayment,
      extraMonthlyPayment,
      timeline,
      perDebt,
      payoffOrder,
      method,
    };
  }

  // ── Tax-Drag Simulator ─────────────────────────────────────────
  function taxDragSimulation(assets, taxRates = {}) {
    const {
      cgt         = 10,    // Capital Gains Tax %
      withholding = 10,    // Withholding tax on dividends/interest %
      currency    = 'NGN',
    } = taxRates;

    let totalPreTax = 0, totalTax = 0, totalPostTax = 0;
    const breakdown = [];

    assets.forEach(a => {
      if (a.cat === 'liability') return;
      const gain = a.fv > 0 ? Math.max(0, a.fv - (a.principal || a.value)) : 0;
      const investTax   = a.cat === 'investment' ? gain * (cgt / 100) : 0;
      const interestTax = (a.interest || 0) * (withholding / 100);
      const totalAssetTax = investTax + interestTax;
      const postTax = a.value - totalAssetTax;

      totalPreTax  += a.value;
      totalTax     += totalAssetTax;
      totalPostTax += postTax;

      breakdown.push({
        name: a.name, cat: a.cat, preValue: a.value,
        taxAmount: totalAssetTax, postValue: postTax,
        effectiveRate: a.value > 0 ? ((totalAssetTax / a.value) * 100).toFixed(1) : 0,
      });
    });

    return {
      totalPreTax: Math.round(totalPreTax),
      totalTax: Math.round(totalTax),
      totalPostTax: Math.round(totalPostTax),
      effectiveTaxRate: totalPreTax > 0 ? ((totalTax / totalPreTax) * 100).toFixed(2) : 0,
      breakdown,
      currency,
    };
  }

  // ── Asset Allocation Optimizer ─────────────────────────────────
  function allocationOptimizer(assets) {
    const totals = { cash: 0, physical: 0, investment: 0, liability: 0 };
    let totalPositive = 0;
    assets.forEach(a => {
      totals[a.cat] = (totals[a.cat] || 0) + a.value;
      if (a.cat !== 'liability') totalPositive += a.value;
    });

    const cashPct   = totalPositive > 0 ? (totals.cash / totalPositive) * 100 : 0;
    const physPct   = totalPositive > 0 ? (totals.physical / totalPositive) * 100 : 0;
    const invPct    = totalPositive > 0 ? (totals.investment / totalPositive) * 100 : 0;
    const debtRatio = totalPositive > 0 ? (totals.liability / totalPositive) * 100 : 0;

    const recommendations = [];

    if (cashPct > 30) recommendations.push({ type: 'warning', msg: `Cash allocation is ${cashPct.toFixed(0)}% — consider deploying excess into investments to beat inflation.` });
    if (cashPct < 5)  recommendations.push({ type: 'danger',  msg: 'Emergency fund is too low. Aim for at least 3–6 months expenses in liquid cash.' });
    if (invPct < 20)  recommendations.push({ type: 'info',    msg: `Only ${invPct.toFixed(0)}% in investments. Consider increasing to 40–60% for long-term wealth growth.` });
    if (debtRatio > 40) recommendations.push({ type: 'danger', msg: `Debt-to-asset ratio is high at ${debtRatio.toFixed(0)}%. Focus on debt reduction before expanding assets.` });
    if (physPct > 60) recommendations.push({ type: 'warning', msg: `${physPct.toFixed(0)}% in physical assets — illiquid. Ensure you have liquid reserves.` });
    if (recommendations.length === 0) recommendations.push({ type: 'success', msg: 'Your portfolio allocation looks healthy! Keep maintaining a balanced approach.' });

    return {
      percentages: { cashPct, physPct, invPct, debtRatio },
      recommendations,
      riskScore: debtRatio > 50 ? 'High' : debtRatio > 25 ? 'Medium' : 'Low',
    };
  }

  // ── FX Rates (live fetch + cache, 160+ currencies) ──────────────
  const CURRENCY_SYMBOLS = {
    USD:'$',  EUR:'€',  GBP:'£',  JPY:'¥',  CNY:'¥',  INR:'₹',
    AUD:'AU$',CAD:'CA$',CHF:'CHF',NZD:'NZ$',MXN:'MX$',BRL:'R$',
    NGN:'₦',  GHS:'₵',  KES:'KSh', ZAR:'R',  EGP:'E£',  MAD:'DH',
    KRW:'₩',  RUB:'₽',  TRY:'₺',  SEK:'kr', NOK:'kr', DKK:'kr',
    PLN:'zł', HUF:'Ft', CZK:'Kč', RON:'lei',BGN:'лв', HRK:'kn',
    SGD:'S$', HKD:'HK$',TWD:'NT$',THB:'฿',  MYR:'RM', IDR:'Rp',
    PHP:'₱',  VND:'₫',  PKR:'₨',  BDT:'৳',  AED:'د.إ',SAR:'﷼',
    QAR:'QR', KWD:'KD', ILS:'₪',  CLP:'CLP',COP:'COL$',PEN:'S/',
    ARS:'AR$',UYU:'\$U',CRC:'₡',  DOP:'RD$',JMD:'J$', TTD:'TT$',
    ANG:'ƒ',  AWG:'ƒ',  BBD:'Bds$',BSD:'B$', BMD:'BD$',BZD:'BZ$',
    KYD:'CI$',XCD:'EC$',GYD:'GY$', LRD:'L$', NAD:'N$', SZL:'E',
    LSL:'M',  BWP:'P',  MWK:'MK', ZMW:'ZK', TZS:'TSh',UGX:'USh',
    RWF:'RF', BIF:'FBu',ETB:'Br',  GHS:'₵',  NGN:'₦',  GMD:'D',
    SLL:'Le', GNF:'FG', XOF:'CFA', XAF:'FCFA',XOF:'CFA',XAF:'FCFA',
    LKR:'₨',  NPR:'₨',  BDT:'৳',  MMK:'K',  KHR:'៛',  LAK:'₭',
    MNT:'₮',  KPW:'₩',  IRR:'﷼',  IQD:'ع.د',SYP:'£S', JOD:'JD',
    LBP:'£L', OMR:'﷼',  BHD:'BD', KWD:'KD', AED:'د.إ',SAR:'﷼',
    QAR:'QR', YER:'﷼',  FJD:'FJ$',TOP:'T$', WST:'WS$',VUV:'VT',
    PGK:'K',  SBD:'SI$',KID:'KI$',TVD:'TV$',NOK:'kr', SEK:'kr',
    DKK:'kr', ISK:'kr', ALL:'L',  MDL:'L',  GEL:'₾',  AMD:'֏',
    AZN:'₼',  BYN:'Br', UAH:'₴',  KZT:'₸',  KGS:'с',  TJS:'SM',
    UZS:'soʻm',TMT:'m', MKD:'ден',RSD:'дин',BAM:'KM', ISK:'kr',
  };
  function getCurrencySymbol(code) {
    return CURRENCY_SYMBOLS[code] || code + ' ';
  }

  const MOCK_RATES = { USD:1, EUR:0.92, GBP:0.79, JPY:161, CNY:6.79, INR:94.4,
    AUD:1.43, CAD:1.41, CHF:0.81, NZD:1.74, MXN:17.3, BRL:5.16,
    NGN:1365, GHS:11.3, KES:129, ZAR:16.5, EGP:49.9, MAD:9.31,
    KRW:1531, RUB:73.3, TRY:46.5, SEK:9.58, NOK:9.69, DKK:6.51,
    PLN:3.71, HUF:307, CZK:21.1, SGD:1.29, HKD:7.84, THB:32.9,
    MYR:4.13, IDR:17789, PHP:60.7, VND:26421, PKR:280, AED:3.67,
    SAR:3.75, ILS:2.96, ARS:1460, CLP:899, COP:3477, PEN:3.42 };
  let _rates = { ...MOCK_RATES };
  let _ratesLastFetched = null;
  let _baseCurrency = 'USD';

  async function fetchFXRates() {
    try {
      // open.er-api.com — free, no key, 160+ currencies
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error('API status ' + res.status);
      const data = await res.json();
      if (data.result !== 'success') throw new Error('API result: ' + data.result);
      // Store ALL rates from the API
      _rates = data.rates;  // 160+ currency pairs
      _rates.USD = 1;
      _ratesLastFetched = Date.now();
      localStorage.setItem('kv-fx-rates', JSON.stringify({ rates: _rates, fetchedAt: _ratesLastFetched }));
      console.log('[FX] Loaded ' + Object.keys(_rates).length + ' live currency rates');
      return _rates;
    } catch(e) {
      console.warn('[FX] Live fetch failed, trying cache:', e.message);
      const cached = localStorage.getItem('kv-fx-rates');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          _rates = parsed.rates;
          _ratesLastFetched = parsed.fetchedAt || null;
        } catch(pe) {}
      }
      return _rates;
    }
  }

  function convertCurrency(amount, from, to) {
    from = from || getBaseCurrency();
    to   = to   || getBaseCurrency();
    if (from === to) return amount;
    var fromRate = _rates[from] || 1;
    var toRate   = _rates[to]   || 1;
    return (amount / fromRate) * toRate;
  }

  function setBaseCurrency(currency) {
    _baseCurrency = currency;
    localStorage.setItem('kv-base-currency', currency);
  }

  function getBaseCurrency() {
    return localStorage.getItem('kv-base-currency') || 'USD';
  }

  // Native currency — what the user's data is actually stored in
  function getNativeCurrency() {
    var nc = localStorage.getItem('kv-native-currency');
    var v  = localStorage.getItem('kv-currency-version');
    // Auto-heal: if we migrated versions, native = base (no stale conversion)
    if (!v || v !== '2') { setNativeCurrency(getBaseCurrency()); localStorage.setItem('kv-currency-version','2'); return getBaseCurrency(); }
    if (!nc) return getBaseCurrency();
    return nc;
  }
  function setNativeCurrency(c) {
    localStorage.setItem('kv-native-currency', c);
    localStorage.setItem('kv-currency-version', '2');
  }

  function formatCurrency(amount, currency) {
    var cur = currency || getBaseCurrency();
    var displayAmount = Math.abs(amount);
    // Auto-convert from native to display currency when using base currency
    if (!currency) {
      var nativeCur = getNativeCurrency();
      if (nativeCur && nativeCur !== cur) {
        displayAmount = Math.abs(convertCurrency(Math.abs(amount), nativeCur, cur));
      }
    }
    return getCurrencySymbol(cur) + displayAmount.toLocaleString('en', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  // Init
  async function init() {
    _baseCurrency = getBaseCurrency();
    // Check if we have fresh rates (< 12hrs)
    var cached = localStorage.getItem('kv-fx-rates');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const { rates, fetchedAt } = parsed;
        _ratesLastFetched = fetchedAt || null;
        if (fetchedAt && Date.now() - fetchedAt < 12 * 60 * 60 * 1000) {
          _rates = rates; return;
        }
      } catch(e) {}
    }
    await fetchFXRates();
  }

  return {
    compoundInterest, netWorthScore, straightLineDepreciation,
    reducingBalanceDepreciation, currentBookValue, fireSimulation,
    debtPaydown, taxDragSimulation, allocationOptimizer,
    fetchFXRates, convertCurrency, setBaseCurrency, getBaseCurrency,
    getNativeCurrency, setNativeCurrency,
    formatCurrency, getCurrencySymbol, init,
    get rates() { return _rates; },
    get ratesLastFetched() { return _ratesLastFetched; },
  };
})();