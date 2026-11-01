(function () {
  "use strict";

  var liveRegion = document.getElementById("liveRegion");
  function announce(msg) {
    if (liveRegion) liveRegion.textContent = msg;
  }

  var prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Reading progress bar ---------- */
  var progressBar = document.getElementById("readingProgressBar");
  function updateReadingProgress() {
    if (!progressBar) return;
    var doc = document.documentElement;
    var scrollTop = doc.scrollTop || document.body.scrollTop;
    var scrollHeight = (doc.scrollHeight || document.body.scrollHeight) - doc.clientHeight;
    var pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    progressBar.style.width = Math.min(100, Math.max(0, pct)) + "%";
  }
  document.addEventListener("scroll", updateReadingProgress, { passive: true });
  window.addEventListener("resize", updateReadingProgress);
  updateReadingProgress();

  /* ---------- Chip nav active state ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll("#chipNav a"));
  var navByHash = {};
  navLinks.forEach(function (a) {
    navByHash[a.getAttribute("href")] = a;
  });

  var observedSections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  function setActiveNav(hash) {
    navLinks.forEach(function (a) { a.classList.remove("is-active"); });
    var active = navByHash[hash];
    if (active) active.classList.add("is-active");
  }

  if ("IntersectionObserver" in window && observedSections.length) {
    var currentHash = null;
    var io = new IntersectionObserver(
      function (entries) {
        var best = null;
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
          }
        });
        if (best) {
          var hash = "#" + best.target.id;
          if (hash !== currentHash) {
            currentHash = hash;
            setActiveNav(hash);
          }
        }
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    observedSections.forEach(function (s) { io.observe(s); });
  }

  /* ---------- Copy buttons ---------- */
  function fallbackCopy(text) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  document.querySelectorAll(".copy-btn").forEach(function (btn) {
    var block = btn.closest(".copy-block");
    var source = block ? block.querySelector(".copy-source") : null;
    if (!source) return;

    btn.addEventListener("click", function () {
      var text = source.textContent.trim();
      var originalLabel = btn.textContent;
      Promise.resolve(copyText(text)).then(function () {
        btn.textContent = "Copied";
        btn.classList.add("is-copied");
        var label = btn.getAttribute("data-copy-label") || "Text";
        announce(label + " copied to clipboard");
        setTimeout(function () {
          btn.textContent = originalLabel;
          btn.classList.remove("is-copied");
        }, 2000);
      });
    });
  });

  /* ---------- Show all / clip toggle ---------- */
  document.querySelectorAll(".show-all-btn").forEach(function (btn) {
    var block = btn.closest(".copy-block");
    if (!block) return;
    btn.addEventListener("click", function () {
      var expanded = block.classList.toggle("is-expanded");
      btn.textContent = expanded ? "Show less" : "Show all";
    });
  });

  /* ---------- Persisted checklists ---------- */
  function initChecklistGroup(storageKey) {
    var checkboxes = Array.prototype.slice.call(
      document.querySelectorAll('[data-storage-key="' + storageKey + '"] input[type="checkbox"]')
    );
    if (!checkboxes.length) return { checkboxes: checkboxes };

    var saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch (err) {
      saved = {};
    }

    checkboxes.forEach(function (cb) {
      var id = cb.getAttribute("data-id");
      if (saved[id]) cb.checked = true;
    });

    function persist() {
      var state = {};
      checkboxes.forEach(function (cb) {
        state[cb.getAttribute("data-id")] = cb.checked;
      });
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch (err) {
        /* storage unavailable, ignore */
      }
    }

    checkboxes.forEach(function (cb) {
      cb.addEventListener("change", persist);
    });

    return { checkboxes: checkboxes, persist: persist };
  }

  initChecklistGroup("booked-v3-compliance");

  /* ---------- Manual steps progress ---------- */
  var STEPS_KEY = "booked-v3-manual";
  var stepsGroup = initChecklistGroup(STEPS_KEY);
  var stepsFill = document.getElementById("stepsProgressFill");
  var stepsLabel = document.getElementById("stepsProgressLabel");
  var stepsReset = document.getElementById("stepsReset");

  function stepElFor(cb) {
    return cb.closest(".step");
  }

  function updateStepsProgress() {
    if (!stepsGroup.checkboxes.length) return;
    var total = stepsGroup.checkboxes.length;
    var done = 0;
    stepsGroup.checkboxes.forEach(function (cb) {
      var step = stepElFor(cb);
      if (cb.checked) {
        done++;
        if (step) step.classList.add("is-done");
      } else if (step) {
        step.classList.remove("is-done");
      }
    });
    var pct = (done / total) * 100;
    if (stepsFill) stepsFill.style.transform = "scaleX(" + (pct / 100) + ")";
    if (stepsLabel) stepsLabel.textContent = done + "/" + total + " done";
  }

  if (stepsGroup.checkboxes.length) {
    stepsGroup.checkboxes.forEach(function (cb) {
      cb.addEventListener("change", updateStepsProgress);
    });
    updateStepsProgress();
  }

  if (stepsReset) {
    stepsReset.addEventListener("click", function () {
      stepsGroup.checkboxes.forEach(function (cb) { cb.checked = false; });
      if (stepsGroup.persist) stepsGroup.persist();
      updateStepsProgress();
      announce("Manual progress reset");
    });
  }

  /* ---------- Revenue calculator ---------- */
  var calcForm = document.getElementById("calculatorForm");
  if (calcForm) {
    var clientsInput = document.getElementById("calcClients");
    var refillsInput = document.getElementById("calcRefills");
    var feeInput = document.getElementById("calcFee");
    var monthlyFeeInput = document.getElementById("calcMonthlyFee");
    var runningCostInput = document.getElementById("calcRunningCost");
    var monthlyOut = document.getElementById("calcMonthlyOut");
    var yearlyOut = document.getElementById("calcYearlyOut");

    var currencyFormatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

    function num(input) {
      var v = parseFloat(input.value);
      return isFinite(v) && v >= 0 ? v : 0;
    }

    function recalc() {
      var clients = num(clientsInput);
      var refills = num(refillsInput);
      var fee = num(feeInput);
      var monthlyFee = num(monthlyFeeInput);
      var runningCost = num(runningCostInput);

      var revenuePerClient = refills * fee + monthlyFee;
      var costPerClient = refills * runningCost;
      var monthlyTotal = clients * (revenuePerClient - costPerClient);
      var yearlyTotal = monthlyTotal * 12;

      monthlyOut.textContent = currencyFormatter.format(monthlyTotal);
      yearlyOut.textContent = currencyFormatter.format(yearlyTotal);
    }

    [clientsInput, refillsInput, feeInput, monthlyFeeInput, runningCostInput].forEach(function (input) {
      input.addEventListener("input", recalc);
    });
    calcForm.addEventListener("submit", function (e) { e.preventDefault(); });

    recalc();
  }

  if (prefersReducedMotion) {
    document.documentElement.style.scrollBehavior = "auto";
  }
})();
