"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _xhtml = require("./xhtml");

var _types = require("../../tokenizer/types");

var _context = require("../../tokenizer/context");

var N = require("../../types");

var _identifier = require("../../util/identifier");

var _whitespace = require("../../util/whitespace");

var _parseError = require("../../parse-error");

const JsxErrors = (0, _parseError.ParseErrorEnum)`jsx`({
  AttributeIsEmpty: "JSX attributes must only be assigned a non-empty expression.",
  MissingClosingTagElement: ({
    openingTagName
  }) => `Expected corresponding JSX closing tag for <${openingTagName}>.`,
  MissingClosingTagFragment: "Expected corresponding JSX closing tag for <>.",
  UnexpectedSequenceExpression: "Sequence expressions cannot be directly nested inside JSX. Did you mean to wrap it in parentheses (...)?",
  UnexpectedToken: ({
    unexpected,
    HTMLEntity
  }) => `Unexpected token \`${unexpected}\`. Did you mean \`${HTMLEntity}\` or \`{'${unexpected}'}\`?`,
  UnsupportedJsxValue: "JSX value should be either an expression or a quoted JSX text.",
  UnterminatedJsxContent: "Unterminated JSX contents.",
  UnwrappedAdjacentJSXElements: "Adjacent JSX elements must be wrapped in an enclosing tag. Did you want a JSX fragment <>...</>?"
});

function isFragment(object) {
  return object ? object.type === "JSXOpeningFragment" || object.type === "JSXClosingFragment" : false;
}

function getQualifiedJSXName(object) {
  if (object.type === "JSXIdentifier") {
    return object.name;
  }

  if (object.type === "JSXNamespacedName") {
    return object.namespace.name + ":" + object.name.name;
  }

  if (object.type === "JSXMemberExpression") {
    return getQualifiedJSXName(object.object) + "." + getQualifiedJSXName(object.property);
  }

  throw new Error("Node had unexpected type: " + object.type);
}

var _default = superClass => class JSXParserMixin extends superClass {
  jsxReadToken() {
    let out = "";
    let chunkStart = this.state.pos;

    for (;;) {
      if (this.state.pos >= this.length) {
        throw this.raise(JsxErrors.UnterminatedJsxContent, {
          at: this.state.startLoc
        });
      }

      const ch = this.input.charCodeAt(this.state.pos);

      switch (ch) {
        case 60:
        case 123:
          if (this.state.pos === this.state.start) {
            if (ch === 60 && this.state.canStartJSXElement) {
              ++this.state.pos;
              return this.finishToken(138);
            }

            return super.getTokenFromCode(ch);
          }

          out += this.input.slice(chunkStart, this.state.pos);
          return this.finishToken(137, out);

        case 38:
          out += this.input.slice(chunkStart, this.state.pos);
          out += this.jsxReadEntity();
          chunkStart = this.state.pos;
          break;

        case 62:
        case 125:
          if (process.env.BABEL_8_BREAKING) {
            this.raise(JsxErrors.UnexpectedToken, {
              at: this.state.curPosition(),
              unexpected: this.input[this.state.pos],
              HTMLEntity: ch === 125 ? "&rbrace;" : "&gt;"
            });
          }

        default:
          if ((0, _whitespace.isNewLine)(ch)) {
            out += this.input.slice(chunkStart, this.state.pos);
            out += this.jsxReadNewLine(true);
            chunkStart = this.state.pos;
          } else {
            ++this.state.pos;
          }

      }
    }
  }

  jsxReadNewLine(normalizeCRLF) {
    const ch = this.input.charCodeAt(this.state.pos);
    let out;
    ++this.state.pos;

    if (ch === 13 && this.input.charCodeAt(this.state.pos) === 10) {
      ++this.state.pos;
      out = normalizeCRLF ? "\n" : "\r\n";
    } else {
      out = String.fromCharCode(ch);
    }

    ++this.state.curLine;
    this.state.lineStart = this.state.pos;
    return out;
  }

  jsxReadString(quote) {
    let out = "";
    let chunkStart = ++this.state.pos;

    for (;;) {
      if (this.state.pos >= this.length) {
        throw this.raise(_parseError.Errors.UnterminatedString, {
          at: this.state.startLoc
        });
      }

      const ch = this.input.charCodeAt(this.state.pos);
      if (ch === quote) break;

      if (ch === 38) {
        out += this.input.slice(chunkStart, this.state.pos);
        out += this.jsxReadEntity();
        chunkStart = this.state.pos;
      } else if ((0, _whitespace.isNewLine)(ch)) {
        out += this.input.slice(chunkStart, this.state.pos);
        out += this.jsxReadNewLine(false);
        chunkStart = this.state.pos;
      } else {
        ++this.state.pos;
      }
    }

    out += this.input.slice(chunkStart, this.state.pos++);
    return this.finishToken(129, out);
  }

  jsxReadEntity() {
    const startPos = ++this.state.pos;

    if (this.codePointAtPos(this.state.pos) === 35) {
      ++this.state.pos;
      let radix = 10;

      if (this.codePointAtPos(this.state.pos) === 120) {
        radix = 16;
        ++this.state.pos;
      }

      const codePoint = this.readInt(radix, undefined, false, "bail");

      if (codePoint !== null && this.codePointAtPos(this.state.pos) === 59) {
        ++this.state.pos;
        return String.fromCodePoint(codePoint);
      }
    } else {
      let count = 0;
      let semi = false;

      while (count++ < 10 && this.state.pos < this.length && !(semi = this.codePointAtPos(this.state.pos) == 59)) {
        ++this.state.pos;
      }

      if (semi) {
        const desc = this.input.slice(startPos, this.state.pos);
        const entity = _xhtml.default[desc];
        ++this.state.pos;

        if (entity) {
          return entity;
        }
      }
    }

    this.state.pos = startPos;
    return "&";
  }

  jsxReadWord() {
    let ch;
    const start = this.state.pos;

    do {
      ch = this.input.charCodeAt(++this.state.pos);
    } while ((0, _identifier.isIdentifierChar)(ch) || ch === 45);

    return this.finishToken(136, this.input.slice(start, this.state.pos));
  }

  jsxParseIdentifier() {
    const node = this.startNode();

    if (this.match(136)) {
      node.name = this.state.value;
    } else if ((0, _types.tokenIsKeyword)(this.state.type)) {
      node.name = (0, _types.tokenLabelName)(this.state.type);
    } else {
      this.unexpected();
    }

    this.next();
    return this.finishNode(node, "JSXIdentifier");
  }

  jsxParseNamespacedName() {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const name = this.jsxParseIdentifier();
    if (!this.eat(14)) return name;
    const node = this.startNodeAt(startPos, startLoc);
    node.namespace = name;
    node.name = this.jsxParseIdentifier();
    return this.finishNode(node, "JSXNamespacedName");
  }

  jsxParseElementName() {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    let node = this.jsxParseNamespacedName();

    if (node.type === "JSXNamespacedName") {
      return node;
    }

    while (this.eat(16)) {
      const newNode = this.startNodeAt(startPos, startLoc);
      newNode.object = node;
      newNode.property = this.jsxParseIdentifier();
      node = this.finishNode(newNode, "JSXMemberExpression");
    }

    return node;
  }

  jsxParseAttributeValue() {
    let node;

    switch (this.state.type) {
      case 5:
        node = this.startNode();
        this.setContext(_context.types.brace);
        this.next();
        node = this.jsxParseExpressionContainer(node, _context.types.j_oTag);

        if (node.expression.type === "JSXEmptyExpression") {
          this.raise(JsxErrors.AttributeIsEmpty, {
            at: node
          });
        }

        return node;

      case 138:
      case 129:
        return this.parseExprAtom();

      default:
        throw this.raise(JsxErrors.UnsupportedJsxValue, {
          at: this.state.startLoc
        });
    }
  }

  jsxParseEmptyExpression() {
    const node = this.startNodeAt(this.state.lastTokEndLoc.index, this.state.lastTokEndLoc);
    return this.finishNodeAt(node, "JSXEmptyExpression", this.state.startLoc);
  }

  jsxParseSpreadChild(node) {
    this.next();
    node.expression = this.parseExpression();
    this.setContext(_context.types.j_oTag);
    this.state.canStartJSXElement = true;
    this.expect(8);
    return this.finishNode(node, "JSXSpreadChild");
  }

  jsxParseExpressionContainer(node, previousContext) {
    if (this.match(8)) {
      node.expression = this.jsxParseEmptyExpression();
    } else {
      const expression = this.parseExpression();

      if (process.env.BABEL_8_BREAKING) {
        if (expression.type === "SequenceExpression" && !expression.extra?.parenthesized) {
          this.raise(JsxErrors.UnexpectedSequenceExpression, {
            at: expression.expressions[1]
          });
        }
      }

      node.expression = expression;
    }

    this.setContext(previousContext);
    this.state.canStartJSXElement = true;
    this.expect(8);
    return this.finishNode(node, "JSXExpressionContainer");
  }

  jsxParseAttribute() {
    const node = this.startNode();

    if (this.match(5)) {
      this.setContext(_context.types.brace);
      this.next();
      this.expect(21);
      node.argument = this.parseMaybeAssignAllowIn();
      this.setContext(_context.types.j_oTag);
      this.state.canStartJSXElement = true;
      this.expect(8);
      return this.finishNode(node, "JSXSpreadAttribute");
    }

    node.name = this.jsxParseNamespacedName();
    node.value = this.eat(29) ? this.jsxParseAttributeValue() : null;
    return this.finishNode(node, "JSXAttribute");
  }

  jsxParseOpeningElementAt(startPos, startLoc) {
    const node = this.startNodeAt(startPos, startLoc);

    if (this.eat(139)) {
      return this.finishNode(node, "JSXOpeningFragment");
    }

    node.name = this.jsxParseElementName();
    return this.jsxParseOpeningElementAfterName(node);
  }

  jsxParseOpeningElementAfterName(node) {
    const attributes = [];

    while (!this.match(56) && !this.match(139)) {
      attributes.push(this.jsxParseAttribute());
    }

    node.attributes = attributes;
    node.selfClosing = this.eat(56);
    this.expect(139);
    return this.finishNode(node, "JSXOpeningElement");
  }

  jsxParseClosingElementAt(startPos, startLoc) {
    const node = this.startNodeAt(startPos, startLoc);

    if (this.eat(139)) {
      return this.finishNode(node, "JSXClosingFragment");
    }

    node.name = this.jsxParseElementName();
    this.expect(139);
    return this.finishNode(node, "JSXClosingElement");
  }

  jsxParseElementAt(startPos, startLoc) {
    const node = this.startNodeAt(startPos, startLoc);
    const children = [];
    const openingElement = this.jsxParseOpeningElementAt(startPos, startLoc);
    let closingElement = null;

    if (!openingElement.selfClosing) {
      contents: for (;;) {
        switch (this.state.type) {
          case 138:
            startPos = this.state.start;
            startLoc = this.state.startLoc;
            this.next();

            if (this.eat(56)) {
              closingElement = this.jsxParseClosingElementAt(startPos, startLoc);
              break contents;
            }

            children.push(this.jsxParseElementAt(startPos, startLoc));
            break;

          case 137:
            children.push(this.parseExprAtom());
            break;

          case 5:
            {
              const node = this.startNode();
              this.setContext(_context.types.brace);
              this.next();

              if (this.match(21)) {
                children.push(this.jsxParseSpreadChild(node));
              } else {
                children.push(this.jsxParseExpressionContainer(node, _context.types.j_expr));
              }

              break;
            }

          default:
            throw this.unexpected();
        }
      }

      if (isFragment(openingElement) && !isFragment(closingElement) && closingElement !== null) {
        this.raise(JsxErrors.MissingClosingTagFragment, {
          at: closingElement
        });
      } else if (!isFragment(openingElement) && isFragment(closingElement)) {
        this.raise(JsxErrors.MissingClosingTagElement, {
          at: closingElement,
          openingTagName: getQualifiedJSXName(openingElement.name)
        });
      } else if (!isFragment(openingElement) && !isFragment(closingElement)) {
        if (getQualifiedJSXName(closingElement.name) !== getQualifiedJSXName(openingElement.name)) {
          this.raise(JsxErrors.MissingClosingTagElement, {
            at: closingElement,
            openingTagName: getQualifiedJSXName(openingElement.name)
          });
        }
      }
    }

    if (isFragment(openingElement)) {
      node.openingFragment = openingElement;
      node.closingFragment = closingElement;
    } else {
      node.openingElement = openingElement;
      node.closingElement = closingElement;
    }

    node.children = children;

    if (this.match(47)) {
      throw this.raise(JsxErrors.UnwrappedAdjacentJSXElements, {
        at: this.state.startLoc
      });
    }

    return isFragment(openingElement) ? this.finishNode(node, "JSXFragment") : this.finishNode(node, "JSXElement");
  }

  jsxParseElement() {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    this.next();
    return this.jsxParseElementAt(startPos, startLoc);
  }

  setContext(newContext) {
    const {
      context
    } = this.state;
    context[context.length - 1] = newContext;
  }

  parseExprAtom(refExpressionErrors) {
    if (this.match(137)) {
      return this.parseLiteral(this.state.value, "JSXText");
    } else if (this.match(138)) {
      return this.jsxParseElement();
    } else if (this.match(47) && this.input.charCodeAt(this.state.pos) !== 33) {
      this.replaceToken(138);
      return this.jsxParseElement();
    } else {
      return super.parseExprAtom(refExpressionErrors);
    }
  }

  skipSpace() {
    const curContext = this.curContext();
    if (!curContext.preserveSpace) super.skipSpace();
  }

  getTokenFromCode(code) {
    const context = this.curContext();

    if (context === _context.types.j_expr) {
      return this.jsxReadToken();
    }

    if (context === _context.types.j_oTag || context === _context.types.j_cTag) {
      if ((0, _identifier.isIdentifierStart)(code)) {
        return this.jsxReadWord();
      }

      if (code === 62) {
        ++this.state.pos;
        return this.finishToken(139);
      }

      if ((code === 34 || code === 39) && context === _context.types.j_oTag) {
        return this.jsxReadString(code);
      }
    }

    if (code === 60 && this.state.canStartJSXElement && this.input.charCodeAt(this.state.pos + 1) !== 33) {
      ++this.state.pos;
      return this.finishToken(138);
    }

    return super.getTokenFromCode(code);
  }

  updateContext(prevType) {
    const {
      context,
      type
    } = this.state;

    if (type === 56 && prevType === 138) {
      context.splice(-2, 2, _context.types.j_cTag);
      this.state.canStartJSXElement = false;
    } else if (type === 138) {
      context.push(_context.types.j_oTag);
    } else if (type === 139) {
      const out = context[context.length - 1];

      if (out === _context.types.j_oTag && prevType === 56 || out === _context.types.j_cTag) {
        context.pop();
        this.state.canStartJSXElement = context[context.length - 1] === _context.types.j_expr;
      } else {
        this.setContext(_context.types.j_expr);
        this.state.canStartJSXElement = true;
      }
    } else {
      this.state.canStartJSXElement = (0, _types.tokenComesBeforeExpression)(type);
    }
  }

};

exports.default = _default;

//# sourceMappingURL=index.js.map
