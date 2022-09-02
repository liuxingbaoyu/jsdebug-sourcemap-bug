"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _location = require("../../util/location");

var _scope = require("../../util/scope");

var _scopeflags = require("../../util/scopeflags");

var N = require("../../types");

var _parseError = require("../../parse-error");

class TypeScriptScope extends _scope.Scope {
  types = new Set();
  enums = new Set();
  constEnums = new Set();
  classes = new Set();
  exportOnlyBindings = new Set();
}

class TypeScriptScopeHandler extends _scope.default {
  importsStack = [];

  createScope(flags) {
    this.importsStack.push(new Set());
    return new TypeScriptScope(flags);
  }

  enter(flags) {
    if (flags == _scopeflags.SCOPE_TS_MODULE) {
      this.importsStack.push(new Set());
    }

    super.enter(flags);
  }

  exit() {
    const flags = super.exit();

    if (flags == _scopeflags.SCOPE_TS_MODULE) {
      this.importsStack.pop();
    }
  }

  hasImport(name, allowShadow) {
    const len = this.importsStack.length;

    if (this.importsStack[len - 1].has(name)) {
      return true;
    }

    return !allowShadow && len > 1 && this.importsStack[0].has(name);
  }

  declareName(name, bindingType, loc) {
    if (bindingType & _scopeflags.BIND_FLAGS_TS_IMPORT) {
      if (this.hasImport(name, true)) {
        this.parser.raise(_parseError.Errors.VarRedeclaration, {
          at: loc,
          identifierName: name
        });
      }

      this.importsStack[this.importsStack.length - 1].add(name);
      return;
    }

    const scope = this.currentScope();

    if (bindingType & _scopeflags.BIND_FLAGS_TS_EXPORT_ONLY) {
      this.maybeExportDefined(scope, name);
      scope.exportOnlyBindings.add(name);
      return;
    }

    super.declareName(name, bindingType, loc);

    if (bindingType & _scopeflags.BIND_KIND_TYPE) {
      if (!(bindingType & _scopeflags.BIND_KIND_VALUE)) {
        this.checkRedeclarationInScope(scope, name, bindingType, loc);
        this.maybeExportDefined(scope, name);
      }

      scope.types.add(name);
    }

    if (bindingType & _scopeflags.BIND_FLAGS_TS_ENUM) scope.enums.add(name);
    if (bindingType & _scopeflags.BIND_FLAGS_TS_CONST_ENUM) scope.constEnums.add(name);
    if (bindingType & _scopeflags.BIND_FLAGS_CLASS) scope.classes.add(name);
  }

  isRedeclaredInScope(scope, name, bindingType) {
    if (scope.enums.has(name)) {
      if (bindingType & _scopeflags.BIND_FLAGS_TS_ENUM) {
        const isConst = !!(bindingType & _scopeflags.BIND_FLAGS_TS_CONST_ENUM);
        const wasConst = scope.constEnums.has(name);
        return isConst !== wasConst;
      }

      return true;
    }

    if (bindingType & _scopeflags.BIND_FLAGS_CLASS && scope.classes.has(name)) {
      if (scope.lexical.has(name)) {
        return !!(bindingType & _scopeflags.BIND_KIND_VALUE);
      } else {
        return false;
      }
    }

    if (bindingType & _scopeflags.BIND_KIND_TYPE && scope.types.has(name)) {
      return true;
    }

    return super.isRedeclaredInScope(scope, name, bindingType);
  }

  checkLocalExport(id) {
    const topLevelScope = this.scopeStack[0];
    const {
      name
    } = id;

    if (!topLevelScope.types.has(name) && !topLevelScope.exportOnlyBindings.has(name) && !this.hasImport(name)) {
      super.checkLocalExport(id);
    }
  }

}

exports.default = TypeScriptScopeHandler;

//# sourceMappingURL=scope.js.map
