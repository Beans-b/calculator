// ---------- State ----------

const display = document.getElementById("display");

const state = {
    expression: "0",      // what the user has typed, using + - * / ^
    error: false,         // true while an error message is showing
    justCalculated: false // true right after "=" so the next digit starts fresh
};

const OPERATORS = "+-*/^";

// Errors we expect, shown to the user as friendly messages
class CalcError extends Error {}

// ---------- Display ----------

function prettify(expression) {
    return expression
        .replace(/\*/g, "×")
        .replace(/\//g, "÷")
        .replace(/(^|[^e])-/g, "$1−"); // keep e-notation like 1e-7 as typed
}

function updateDisplay() {
    display.value = prettify(state.expression);
    display.classList.remove("error");
}

function showError(message) {
    state.error = true;
    state.expression = "0";
    state.justCalculated = false;
    display.value = message;
    display.classList.add("error");
}

// ---------- Safe expression evaluator (no eval / Function) ----------

function tokenize(expression) {
    const tokens = [];
    let i = 0;

    while (i < expression.length) {
        const char = expression[i];

        if ("0123456789.".includes(char)) {
            // Also accepts e-notation such as 1e+21 for very large results
            const number = expression.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/);
            if (!number || expression[i + number[0].length] === ".") {
                throw new CalcError("Invalid number");
            }
            tokens.push(parseFloat(number[0]));
            i += number[0].length;
            continue;
        }

        if (OPERATORS.includes(char)) {
            const previous = tokens[tokens.length - 1];
            // A minus at the start or right after another operator is a negative sign
            if (char === "-" && (previous === undefined || typeof previous === "string")) {
                tokens.push("neg");
            } else {
                tokens.push(char);
            }
            i++;
            continue;
        }

        throw new CalcError("Invalid input");
    }

    return tokens;
}

const PRECEDENCE = { "+": 1, "-": 1, "*": 2, "/": 2, "neg": 3, "^": 4 };

function applyOperator(operator, values) {
    if (operator === "neg") {
        if (values.length < 1) throw new CalcError("Invalid expression");
        values.push(-values.pop());
        return;
    }

    if (values.length < 2) throw new CalcError("Invalid expression");
    const b = values.pop();
    const a = values.pop();

    switch (operator) {
        case "+": values.push(a + b); break;
        case "-": values.push(a - b); break;
        case "*": values.push(a * b); break;
        case "/":
            if (b === 0) throw new CalcError("Cannot divide by 0");
            values.push(a / b);
            break;
        case "^": values.push(Math.pow(a, b)); break;
    }
}

// Shunting-yard: respects precedence, so 2 + 3 * 4 = 14 and 2 ^ 3 ^ 2 = 512
function evaluate(expression) {
    const values = [];
    const operators = [];

    for (const token of tokenize(expression)) {
        if (typeof token === "number") {
            values.push(token);
            continue;
        }

        // Unary minus and ^ are right-associative, so they never pop an equal operator
        const rightAssociative = token === "neg" || token === "^";
        while (operators.length && token !== "neg") {
            const top = operators[operators.length - 1];
            const shouldPop = PRECEDENCE[top] > PRECEDENCE[token] ||
                (PRECEDENCE[top] === PRECEDENCE[token] && !rightAssociative);
            if (!shouldPop) break;
            applyOperator(operators.pop(), values);
        }
        operators.push(token);
    }

    while (operators.length) {
        applyOperator(operators.pop(), values);
    }

    if (values.length !== 1) throw new CalcError("Invalid expression");
    return checkResult(values[0]);
}

function checkResult(result) {
    if (Number.isNaN(result)) throw new CalcError("Invalid input");
    if (!Number.isFinite(result)) throw new CalcError("Number too large");
    // Hide floating point noise like 0.1 + 0.2 = 0.30000000000000004
    return parseFloat(result.toPrecision(12));
}

// Value of whatever is on screen right now (ignores a trailing operator)
function currentValue() {
    const expression = state.expression.replace(/[+\-*/^]+$/, "");
    return evaluate(expression || "0");
}

// Runs an action and turns expected errors into friendly messages
function safely(action) {
    try {
        action();
    } catch (error) {
        if (error instanceof CalcError) {
            showError(error.message);
        } else {
            showError("Something went wrong");
            console.error(error);
        }
    }
}

// Any key press after an error clears the message first
function clearErrorIfShown() {
    if (state.error) {
        state.error = false;
        state.expression = "0";
        updateDisplay();
    }
}

function showResult(result) {
    state.expression = String(result);
    state.justCalculated = true;
    updateDisplay();
}

// ---------- Basic input ----------

function addValue(value) {
    clearErrorIfShown();
    const last = state.expression.slice(-1);

    if (OPERATORS.includes(value)) {
        state.justCalculated = false;
        if (!OPERATORS.includes(last)) {
            state.expression += value;
        } else if (value === "-" && last !== "-") {
            // Allow a negative number after an operator, e.g. 5 × −2
            state.expression += value;
        } else {
            // Replace the operator(s) the user already typed
            state.expression = state.expression.replace(/[+\-*/^]+$/, "") + value;
        }
    } else if (value === ".") {
        if (state.justCalculated) {
            state.expression = "0";
            state.justCalculated = false;
        }
        const currentNumber = state.expression.split(/[+\-*/^]/).pop();
        if (currentNumber.includes(".")) return;
        state.expression += OPERATORS.includes(last) ? "0." : ".";
    } else {
        // Digits: replace a lone leading zero instead of writing "05"
        const currentNumber = state.expression.split(/[+\-*/^]/).pop();
        if (state.justCalculated || state.expression === "0") {
            state.expression = value;
        } else if (currentNumber === "0") {
            state.expression = state.expression.slice(0, -1) + value;
        } else {
            state.expression += value;
        }
        state.justCalculated = false;
    }

    updateDisplay();
}

function clearDisplay() {
    state.expression = "0";
    state.error = false;
    state.justCalculated = false;
    updateDisplay();
}

function backspace() {
    if (state.error || state.justCalculated) {
        clearDisplay();
        return;
    }
    state.expression = state.expression.slice(0, -1);
    if (state.expression === "" || state.expression === "-") {
        state.expression = "0";
    }
    updateDisplay();
}

function calculate() {
    if (state.error) {
        clearDisplay();
        return;
    }

    safely(function () {
        const expression = state.expression.replace(/[+\-*/^]+$/, "");
        const result = currentValue();
        // Only log real calculations, not "5 = 5"
        if (expression !== String(result)) {
            addToHistory(formatExpression(expression), result);
        }
        showResult(result);
    });
}

// ---------- Scientific operations ----------

// Finds the number being typed right now, e.g. "12+-3.5" -> sign "-", digits "3.5"
function lastNumber() {
    const match = state.expression.match(/(?:^|[+\-*/^])(-?)(\d+\.?\d*|\.\d+)$/);
    if (!match) return null;
    return {
        sign: match[1],
        digits: match[2],
        start: state.expression.length - match[1].length - match[2].length
    };
}

function replaceLastNumber(number, newText) {
    state.expression = state.expression.slice(0, number.start) + newText;
    state.justCalculated = false;
    updateDisplay();
}

function percentage() {
    clearErrorIfShown();
    safely(function () {
        const number = lastNumber();
        if (!number) return;
        const value = parseFloat(number.sign + number.digits);
        replaceLastNumber(number, String(checkResult(value / 100)));
    });
}

function toggleSign() {
    clearErrorIfShown();
    const number = lastNumber();
    if (!number || parseFloat(number.digits) === 0) return;

    const flippedSign = number.sign === "-" ? "" : "-";
    replaceLastNumber(number, flippedSign + number.digits);
}

function squareRoot() {
    clearErrorIfShown();
    safely(function () {
        const value = currentValue();
        if (value < 0) throw new CalcError("Cannot take √ of a negative");
        const result = checkResult(Math.sqrt(value));
        addToHistory("√" + formatNumber(value), result);
        showResult(result);
    });
}

function square() {
    clearErrorIfShown();
    safely(function () {
        const value = currentValue();
        const result = checkResult(value * value);
        addToHistory(formatNumber(value) + "²", result);
        showResult(result);
    });
}

// ---------- Memory (MC, MR, M+, M-) ----------

const memoryIndicator = document.getElementById("memoryIndicator");

let memory = 0;

function updateMemoryIndicator() {
    memoryIndicator.hidden = memory === 0;
}

function memoryClear() {
    memory = 0;
    updateMemoryIndicator();
}

function memoryRecall() {
    clearErrorIfShown();
    const number = lastNumber();
    const last = state.expression.slice(-1);

    if (OPERATORS.includes(last)) {
        // After an operator, MR fills in the next number: 5 + MR
        state.expression += String(memory);
        state.justCalculated = false;
        updateDisplay();
    } else if (number && number.start > 0 && !state.justCalculated) {
        replaceLastNumber(number, String(memory));
    } else {
        showResult(memory);
    }
}

function memoryAdd() {
    clearErrorIfShown();
    safely(function () {
        memory = checkResult(memory + currentValue());
        state.justCalculated = true;
        updateMemoryIndicator();
    });
}

function memorySubtract() {
    clearErrorIfShown();
    safely(function () {
        memory = checkResult(memory - currentValue());
        state.justCalculated = true;
        updateMemoryIndicator();
    });
}

// ---------- Calculation history ----------

const HISTORY_KEY = "calculator-history";
const MAX_HISTORY = 50;

const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");

let calcHistory = loadHistory();

// "15*4" -> "15 × 4"
function formatExpression(expression) {
    // Space out operators that follow a number, but not negative signs
    return prettify(expression.replace(/([\d.])([+\-*/^])/g, "$1 $2 "));
}

// Wraps negatives in brackets so "(−3)²" reads clearly
function formatNumber(value) {
    return value < 0 ? "(−" + Math.abs(value) + ")" : String(value);
}

function loadHistory() {
    try {
        const saved = JSON.parse(localStorage.getItem(HISTORY_KEY));
        return Array.isArray(saved) ? saved : [];
    } catch {
        return [];
    }
}

function saveHistory() {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(calcHistory));
    } catch {
        // Storage can be blocked (e.g. private browsing); history still works for this visit
    }
}

function addToHistory(expression, result) {
    calcHistory.unshift({ expression: expression, result: result });
    calcHistory = calcHistory.slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
}

function renderHistory() {
    historyList.innerHTML = "";
    historyEmpty.hidden = calcHistory.length > 0;

    calcHistory.forEach(function (entry) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "history-entry";
        button.title = "Use this result";

        const expression = document.createElement("span");
        expression.className = "history-expression";
        expression.textContent = entry.expression + " =";

        const result = document.createElement("span");
        result.className = "history-result";
        result.textContent = prettify(String(entry.result));

        button.append(expression, result);
        button.addEventListener("click", function () {
            useHistoryResult(entry.result);
        });

        item.append(button);
        historyList.append(item);
    });
}

// Clicking an entry loads its result back into the display
function useHistoryResult(result) {
    state.error = false;
    showResult(result);
}

function clearHistory() {
    calcHistory = [];
    saveHistory();
    renderHistory();
}

// ---------- Keyboard support ----------

document.addEventListener("keydown", function (event) {
    const key = event.key;

    // Let Enter and Space press whichever button has keyboard focus
    if ((key === "Enter" || key === " ") && document.activeElement.tagName === "BUTTON") {
        return;
    }

    if ("0123456789+-*/.^".includes(key)) {
        addValue(key);
    } else if (key === "Enter" || key === "=") {
        event.preventDefault();
        calculate();
    } else if (key === "Escape" || key === "Delete") {
        clearDisplay();
    } else if (key === "Backspace") {
        backspace();
    } else if (key === "%") {
        percentage();
    } else if (key === "r" || key === "R") {
        squareRoot();
    } else if (key === "s" || key === "S") {
        square();
    } else if (key === "n" || key === "N") {
        toggleSign();
    }
});

// ---------- Theme toggle ----------

const themeToggle = document.getElementById("themeToggle");

themeToggle.addEventListener("click", function () {
    document.body.classList.toggle("dark-mode");

    if (document.body.classList.contains("dark-mode")) {
        themeToggle.textContent = "Switch to Light Mode";
    } else {
        themeToggle.textContent = "Switch to Dark Mode";
    }
});

renderHistory();
