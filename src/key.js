var table = {
  188: ",",
  190: ".",
  192: "`",
  189: "-",
  187: "=",
  219: "[",
  220: "\\",
  221: "]",
  9: "<tab>",
  32: "<space>",
  186: ";",
  222: "'",
  191: "/",
  13: "<return>",
};

var shift_table = {
  ",": "<",
  ".": ">",
  "`": "~",
  "-": "_",
  "=": "+",
  "[": "{",
  "\\": "|",
  "]": "}",
  ";": ":",
  "'": "\"",
  "/": "?",
  "1": "!",
  "2": "@",
  "3": "#",
  "4": "$",
  "5": "%",
  "6": "^",
  "7": "&",
  "8": "*",
  "9": "(",
  "0": ")",
};

module.exports = function(e) {
  var base = "[" + e.keyCode + "]";
  if ((e.keyCode > 64 && e.keyCode <= 64 + 26)
      || (e.keyCode >= 48 && e.keyCode <= 48 + 9)) {
    base = String.fromCharCode(e.keyCode).toLowerCase();
  }
  if (table[e.keyCode]) {
    base = table[e.keyCode];
  }
  if (e.shiftKey) {
    if (shift_table[base]) {
      base = shift_table[base];
    }
    else {
      base = "S-" + base;
    }
  }
  if (e.ctrlKey)
    base = "C-" + base;
  if (e.altKey)
    base = "A-" + base;
  if (e.metaKey)
    base = "M-" + base;
  return base;
}
