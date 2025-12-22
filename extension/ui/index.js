var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
(function(exports) {
  "use strict";
  var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
  var jsxRuntime = { exports: {} };
  var reactJsxRuntime_production_min = {};
  var react = { exports: {} };
  var react_production_min = {};
  var hasRequiredReact_production_min;
  function requireReact_production_min() {
    if (hasRequiredReact_production_min) return react_production_min;
    hasRequiredReact_production_min = 1;
    var l2 = Symbol.for("react.element"), n2 = Symbol.for("react.portal"), p2 = Symbol.for("react.fragment"), q2 = Symbol.for("react.strict_mode"), r2 = Symbol.for("react.profiler"), t2 = Symbol.for("react.provider"), u2 = Symbol.for("react.context"), v2 = Symbol.for("react.forward_ref"), w2 = Symbol.for("react.suspense"), x2 = Symbol.for("react.memo"), y2 = Symbol.for("react.lazy"), z2 = Symbol.iterator;
    function A2(a2) {
      if (null === a2 || "object" !== typeof a2) return null;
      a2 = z2 && a2[z2] || a2["@@iterator"];
      return "function" === typeof a2 ? a2 : null;
    }
    var B2 = { isMounted: function() {
      return false;
    }, enqueueForceUpdate: function() {
    }, enqueueReplaceState: function() {
    }, enqueueSetState: function() {
    } }, C2 = Object.assign, D2 = {};
    function E2(a2, b2, e2) {
      this.props = a2;
      this.context = b2;
      this.refs = D2;
      this.updater = e2 || B2;
    }
    E2.prototype.isReactComponent = {};
    E2.prototype.setState = function(a2, b2) {
      if ("object" !== typeof a2 && "function" !== typeof a2 && null != a2) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
      this.updater.enqueueSetState(this, a2, b2, "setState");
    };
    E2.prototype.forceUpdate = function(a2) {
      this.updater.enqueueForceUpdate(this, a2, "forceUpdate");
    };
    function F2() {
    }
    F2.prototype = E2.prototype;
    function G2(a2, b2, e2) {
      this.props = a2;
      this.context = b2;
      this.refs = D2;
      this.updater = e2 || B2;
    }
    var H2 = G2.prototype = new F2();
    H2.constructor = G2;
    C2(H2, E2.prototype);
    H2.isPureReactComponent = true;
    var I2 = Array.isArray, J2 = Object.prototype.hasOwnProperty, K2 = { current: null }, L2 = { key: true, ref: true, __self: true, __source: true };
    function M2(a2, b2, e2) {
      var d2, c2 = {}, k2 = null, h2 = null;
      if (null != b2) for (d2 in void 0 !== b2.ref && (h2 = b2.ref), void 0 !== b2.key && (k2 = "" + b2.key), b2) J2.call(b2, d2) && !L2.hasOwnProperty(d2) && (c2[d2] = b2[d2]);
      var g2 = arguments.length - 2;
      if (1 === g2) c2.children = e2;
      else if (1 < g2) {
        for (var f2 = Array(g2), m2 = 0; m2 < g2; m2++) f2[m2] = arguments[m2 + 2];
        c2.children = f2;
      }
      if (a2 && a2.defaultProps) for (d2 in g2 = a2.defaultProps, g2) void 0 === c2[d2] && (c2[d2] = g2[d2]);
      return { $$typeof: l2, type: a2, key: k2, ref: h2, props: c2, _owner: K2.current };
    }
    function N2(a2, b2) {
      return { $$typeof: l2, type: a2.type, key: b2, ref: a2.ref, props: a2.props, _owner: a2._owner };
    }
    function O2(a2) {
      return "object" === typeof a2 && null !== a2 && a2.$$typeof === l2;
    }
    function escape(a2) {
      var b2 = { "=": "=0", ":": "=2" };
      return "$" + a2.replace(/[=:]/g, function(a3) {
        return b2[a3];
      });
    }
    var P2 = /\/+/g;
    function Q2(a2, b2) {
      return "object" === typeof a2 && null !== a2 && null != a2.key ? escape("" + a2.key) : b2.toString(36);
    }
    function R2(a2, b2, e2, d2, c2) {
      var k2 = typeof a2;
      if ("undefined" === k2 || "boolean" === k2) a2 = null;
      var h2 = false;
      if (null === a2) h2 = true;
      else switch (k2) {
        case "string":
        case "number":
          h2 = true;
          break;
        case "object":
          switch (a2.$$typeof) {
            case l2:
            case n2:
              h2 = true;
          }
      }
      if (h2) return h2 = a2, c2 = c2(h2), a2 = "" === d2 ? "." + Q2(h2, 0) : d2, I2(c2) ? (e2 = "", null != a2 && (e2 = a2.replace(P2, "$&/") + "/"), R2(c2, b2, e2, "", function(a3) {
        return a3;
      })) : null != c2 && (O2(c2) && (c2 = N2(c2, e2 + (!c2.key || h2 && h2.key === c2.key ? "" : ("" + c2.key).replace(P2, "$&/") + "/") + a2)), b2.push(c2)), 1;
      h2 = 0;
      d2 = "" === d2 ? "." : d2 + ":";
      if (I2(a2)) for (var g2 = 0; g2 < a2.length; g2++) {
        k2 = a2[g2];
        var f2 = d2 + Q2(k2, g2);
        h2 += R2(k2, b2, e2, f2, c2);
      }
      else if (f2 = A2(a2), "function" === typeof f2) for (a2 = f2.call(a2), g2 = 0; !(k2 = a2.next()).done; ) k2 = k2.value, f2 = d2 + Q2(k2, g2++), h2 += R2(k2, b2, e2, f2, c2);
      else if ("object" === k2) throw b2 = String(a2), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b2 ? "object with keys {" + Object.keys(a2).join(", ") + "}" : b2) + "). If you meant to render a collection of children, use an array instead.");
      return h2;
    }
    function S2(a2, b2, e2) {
      if (null == a2) return a2;
      var d2 = [], c2 = 0;
      R2(a2, d2, "", "", function(a3) {
        return b2.call(e2, a3, c2++);
      });
      return d2;
    }
    function T2(a2) {
      if (-1 === a2._status) {
        var b2 = a2._result;
        b2 = b2();
        b2.then(function(b3) {
          if (0 === a2._status || -1 === a2._status) a2._status = 1, a2._result = b3;
        }, function(b3) {
          if (0 === a2._status || -1 === a2._status) a2._status = 2, a2._result = b3;
        });
        -1 === a2._status && (a2._status = 0, a2._result = b2);
      }
      if (1 === a2._status) return a2._result.default;
      throw a2._result;
    }
    var U2 = { current: null }, V2 = { transition: null }, W2 = { ReactCurrentDispatcher: U2, ReactCurrentBatchConfig: V2, ReactCurrentOwner: K2 };
    function X2() {
      throw Error("act(...) is not supported in production builds of React.");
    }
    react_production_min.Children = { map: S2, forEach: function(a2, b2, e2) {
      S2(a2, function() {
        b2.apply(this, arguments);
      }, e2);
    }, count: function(a2) {
      var b2 = 0;
      S2(a2, function() {
        b2++;
      });
      return b2;
    }, toArray: function(a2) {
      return S2(a2, function(a3) {
        return a3;
      }) || [];
    }, only: function(a2) {
      if (!O2(a2)) throw Error("React.Children.only expected to receive a single React element child.");
      return a2;
    } };
    react_production_min.Component = E2;
    react_production_min.Fragment = p2;
    react_production_min.Profiler = r2;
    react_production_min.PureComponent = G2;
    react_production_min.StrictMode = q2;
    react_production_min.Suspense = w2;
    react_production_min.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W2;
    react_production_min.act = X2;
    react_production_min.cloneElement = function(a2, b2, e2) {
      if (null === a2 || void 0 === a2) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a2 + ".");
      var d2 = C2({}, a2.props), c2 = a2.key, k2 = a2.ref, h2 = a2._owner;
      if (null != b2) {
        void 0 !== b2.ref && (k2 = b2.ref, h2 = K2.current);
        void 0 !== b2.key && (c2 = "" + b2.key);
        if (a2.type && a2.type.defaultProps) var g2 = a2.type.defaultProps;
        for (f2 in b2) J2.call(b2, f2) && !L2.hasOwnProperty(f2) && (d2[f2] = void 0 === b2[f2] && void 0 !== g2 ? g2[f2] : b2[f2]);
      }
      var f2 = arguments.length - 2;
      if (1 === f2) d2.children = e2;
      else if (1 < f2) {
        g2 = Array(f2);
        for (var m2 = 0; m2 < f2; m2++) g2[m2] = arguments[m2 + 2];
        d2.children = g2;
      }
      return { $$typeof: l2, type: a2.type, key: c2, ref: k2, props: d2, _owner: h2 };
    };
    react_production_min.createContext = function(a2) {
      a2 = { $$typeof: u2, _currentValue: a2, _currentValue2: a2, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null };
      a2.Provider = { $$typeof: t2, _context: a2 };
      return a2.Consumer = a2;
    };
    react_production_min.createElement = M2;
    react_production_min.createFactory = function(a2) {
      var b2 = M2.bind(null, a2);
      b2.type = a2;
      return b2;
    };
    react_production_min.createRef = function() {
      return { current: null };
    };
    react_production_min.forwardRef = function(a2) {
      return { $$typeof: v2, render: a2 };
    };
    react_production_min.isValidElement = O2;
    react_production_min.lazy = function(a2) {
      return { $$typeof: y2, _payload: { _status: -1, _result: a2 }, _init: T2 };
    };
    react_production_min.memo = function(a2, b2) {
      return { $$typeof: x2, type: a2, compare: void 0 === b2 ? null : b2 };
    };
    react_production_min.startTransition = function(a2) {
      var b2 = V2.transition;
      V2.transition = {};
      try {
        a2();
      } finally {
        V2.transition = b2;
      }
    };
    react_production_min.unstable_act = X2;
    react_production_min.useCallback = function(a2, b2) {
      return U2.current.useCallback(a2, b2);
    };
    react_production_min.useContext = function(a2) {
      return U2.current.useContext(a2);
    };
    react_production_min.useDebugValue = function() {
    };
    react_production_min.useDeferredValue = function(a2) {
      return U2.current.useDeferredValue(a2);
    };
    react_production_min.useEffect = function(a2, b2) {
      return U2.current.useEffect(a2, b2);
    };
    react_production_min.useId = function() {
      return U2.current.useId();
    };
    react_production_min.useImperativeHandle = function(a2, b2, e2) {
      return U2.current.useImperativeHandle(a2, b2, e2);
    };
    react_production_min.useInsertionEffect = function(a2, b2) {
      return U2.current.useInsertionEffect(a2, b2);
    };
    react_production_min.useLayoutEffect = function(a2, b2) {
      return U2.current.useLayoutEffect(a2, b2);
    };
    react_production_min.useMemo = function(a2, b2) {
      return U2.current.useMemo(a2, b2);
    };
    react_production_min.useReducer = function(a2, b2, e2) {
      return U2.current.useReducer(a2, b2, e2);
    };
    react_production_min.useRef = function(a2) {
      return U2.current.useRef(a2);
    };
    react_production_min.useState = function(a2) {
      return U2.current.useState(a2);
    };
    react_production_min.useSyncExternalStore = function(a2, b2, e2) {
      return U2.current.useSyncExternalStore(a2, b2, e2);
    };
    react_production_min.useTransition = function() {
      return U2.current.useTransition();
    };
    react_production_min.version = "18.3.1";
    return react_production_min;
  }
  var hasRequiredReact;
  function requireReact() {
    if (hasRequiredReact) return react.exports;
    hasRequiredReact = 1;
    {
      react.exports = requireReact_production_min();
    }
    return react.exports;
  }
  var hasRequiredReactJsxRuntime_production_min;
  function requireReactJsxRuntime_production_min() {
    if (hasRequiredReactJsxRuntime_production_min) return reactJsxRuntime_production_min;
    hasRequiredReactJsxRuntime_production_min = 1;
    var f2 = requireReact(), k2 = Symbol.for("react.element"), l2 = Symbol.for("react.fragment"), m2 = Object.prototype.hasOwnProperty, n2 = f2.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, p2 = { key: true, ref: true, __self: true, __source: true };
    function q2(c2, a2, g2) {
      var b2, d2 = {}, e2 = null, h2 = null;
      void 0 !== g2 && (e2 = "" + g2);
      void 0 !== a2.key && (e2 = "" + a2.key);
      void 0 !== a2.ref && (h2 = a2.ref);
      for (b2 in a2) m2.call(a2, b2) && !p2.hasOwnProperty(b2) && (d2[b2] = a2[b2]);
      if (c2 && c2.defaultProps) for (b2 in a2 = c2.defaultProps, a2) void 0 === d2[b2] && (d2[b2] = a2[b2]);
      return { $$typeof: k2, type: c2, key: e2, ref: h2, props: d2, _owner: n2.current };
    }
    reactJsxRuntime_production_min.Fragment = l2;
    reactJsxRuntime_production_min.jsx = q2;
    reactJsxRuntime_production_min.jsxs = q2;
    return reactJsxRuntime_production_min;
  }
  var hasRequiredJsxRuntime;
  function requireJsxRuntime() {
    if (hasRequiredJsxRuntime) return jsxRuntime.exports;
    hasRequiredJsxRuntime = 1;
    {
      jsxRuntime.exports = requireReactJsxRuntime_production_min();
    }
    return jsxRuntime.exports;
  }
  var jsxRuntimeExports = requireJsxRuntime();
  var client = {};
  var reactDom = { exports: {} };
  var reactDom_production_min = {};
  var scheduler = { exports: {} };
  var scheduler_production_min = {};
  var hasRequiredScheduler_production_min;
  function requireScheduler_production_min() {
    if (hasRequiredScheduler_production_min) return scheduler_production_min;
    hasRequiredScheduler_production_min = 1;
    (function(exports$1) {
      function f2(a2, b2) {
        var c2 = a2.length;
        a2.push(b2);
        a: for (; 0 < c2; ) {
          var d2 = c2 - 1 >>> 1, e2 = a2[d2];
          if (0 < g2(e2, b2)) a2[d2] = b2, a2[c2] = e2, c2 = d2;
          else break a;
        }
      }
      function h2(a2) {
        return 0 === a2.length ? null : a2[0];
      }
      function k2(a2) {
        if (0 === a2.length) return null;
        var b2 = a2[0], c2 = a2.pop();
        if (c2 !== b2) {
          a2[0] = c2;
          a: for (var d2 = 0, e2 = a2.length, w2 = e2 >>> 1; d2 < w2; ) {
            var m2 = 2 * (d2 + 1) - 1, C2 = a2[m2], n2 = m2 + 1, x2 = a2[n2];
            if (0 > g2(C2, c2)) n2 < e2 && 0 > g2(x2, C2) ? (a2[d2] = x2, a2[n2] = c2, d2 = n2) : (a2[d2] = C2, a2[m2] = c2, d2 = m2);
            else if (n2 < e2 && 0 > g2(x2, c2)) a2[d2] = x2, a2[n2] = c2, d2 = n2;
            else break a;
          }
        }
        return b2;
      }
      function g2(a2, b2) {
        var c2 = a2.sortIndex - b2.sortIndex;
        return 0 !== c2 ? c2 : a2.id - b2.id;
      }
      if ("object" === typeof performance && "function" === typeof performance.now) {
        var l2 = performance;
        exports$1.unstable_now = function() {
          return l2.now();
        };
      } else {
        var p2 = Date, q2 = p2.now();
        exports$1.unstable_now = function() {
          return p2.now() - q2;
        };
      }
      var r2 = [], t2 = [], u2 = 1, v2 = null, y2 = 3, z2 = false, A2 = false, B2 = false, D2 = "function" === typeof setTimeout ? setTimeout : null, E2 = "function" === typeof clearTimeout ? clearTimeout : null, F2 = "undefined" !== typeof setImmediate ? setImmediate : null;
      "undefined" !== typeof navigator && void 0 !== navigator.scheduling && void 0 !== navigator.scheduling.isInputPending && navigator.scheduling.isInputPending.bind(navigator.scheduling);
      function G2(a2) {
        for (var b2 = h2(t2); null !== b2; ) {
          if (null === b2.callback) k2(t2);
          else if (b2.startTime <= a2) k2(t2), b2.sortIndex = b2.expirationTime, f2(r2, b2);
          else break;
          b2 = h2(t2);
        }
      }
      function H2(a2) {
        B2 = false;
        G2(a2);
        if (!A2) if (null !== h2(r2)) A2 = true, I2(J2);
        else {
          var b2 = h2(t2);
          null !== b2 && K2(H2, b2.startTime - a2);
        }
      }
      function J2(a2, b2) {
        A2 = false;
        B2 && (B2 = false, E2(L2), L2 = -1);
        z2 = true;
        var c2 = y2;
        try {
          G2(b2);
          for (v2 = h2(r2); null !== v2 && (!(v2.expirationTime > b2) || a2 && !M2()); ) {
            var d2 = v2.callback;
            if ("function" === typeof d2) {
              v2.callback = null;
              y2 = v2.priorityLevel;
              var e2 = d2(v2.expirationTime <= b2);
              b2 = exports$1.unstable_now();
              "function" === typeof e2 ? v2.callback = e2 : v2 === h2(r2) && k2(r2);
              G2(b2);
            } else k2(r2);
            v2 = h2(r2);
          }
          if (null !== v2) var w2 = true;
          else {
            var m2 = h2(t2);
            null !== m2 && K2(H2, m2.startTime - b2);
            w2 = false;
          }
          return w2;
        } finally {
          v2 = null, y2 = c2, z2 = false;
        }
      }
      var N2 = false, O2 = null, L2 = -1, P2 = 5, Q2 = -1;
      function M2() {
        return exports$1.unstable_now() - Q2 < P2 ? false : true;
      }
      function R2() {
        if (null !== O2) {
          var a2 = exports$1.unstable_now();
          Q2 = a2;
          var b2 = true;
          try {
            b2 = O2(true, a2);
          } finally {
            b2 ? S2() : (N2 = false, O2 = null);
          }
        } else N2 = false;
      }
      var S2;
      if ("function" === typeof F2) S2 = function() {
        F2(R2);
      };
      else if ("undefined" !== typeof MessageChannel) {
        var T2 = new MessageChannel(), U2 = T2.port2;
        T2.port1.onmessage = R2;
        S2 = function() {
          U2.postMessage(null);
        };
      } else S2 = function() {
        D2(R2, 0);
      };
      function I2(a2) {
        O2 = a2;
        N2 || (N2 = true, S2());
      }
      function K2(a2, b2) {
        L2 = D2(function() {
          a2(exports$1.unstable_now());
        }, b2);
      }
      exports$1.unstable_IdlePriority = 5;
      exports$1.unstable_ImmediatePriority = 1;
      exports$1.unstable_LowPriority = 4;
      exports$1.unstable_NormalPriority = 3;
      exports$1.unstable_Profiling = null;
      exports$1.unstable_UserBlockingPriority = 2;
      exports$1.unstable_cancelCallback = function(a2) {
        a2.callback = null;
      };
      exports$1.unstable_continueExecution = function() {
        A2 || z2 || (A2 = true, I2(J2));
      };
      exports$1.unstable_forceFrameRate = function(a2) {
        0 > a2 || 125 < a2 ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : P2 = 0 < a2 ? Math.floor(1e3 / a2) : 5;
      };
      exports$1.unstable_getCurrentPriorityLevel = function() {
        return y2;
      };
      exports$1.unstable_getFirstCallbackNode = function() {
        return h2(r2);
      };
      exports$1.unstable_next = function(a2) {
        switch (y2) {
          case 1:
          case 2:
          case 3:
            var b2 = 3;
            break;
          default:
            b2 = y2;
        }
        var c2 = y2;
        y2 = b2;
        try {
          return a2();
        } finally {
          y2 = c2;
        }
      };
      exports$1.unstable_pauseExecution = function() {
      };
      exports$1.unstable_requestPaint = function() {
      };
      exports$1.unstable_runWithPriority = function(a2, b2) {
        switch (a2) {
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
            break;
          default:
            a2 = 3;
        }
        var c2 = y2;
        y2 = a2;
        try {
          return b2();
        } finally {
          y2 = c2;
        }
      };
      exports$1.unstable_scheduleCallback = function(a2, b2, c2) {
        var d2 = exports$1.unstable_now();
        "object" === typeof c2 && null !== c2 ? (c2 = c2.delay, c2 = "number" === typeof c2 && 0 < c2 ? d2 + c2 : d2) : c2 = d2;
        switch (a2) {
          case 1:
            var e2 = -1;
            break;
          case 2:
            e2 = 250;
            break;
          case 5:
            e2 = 1073741823;
            break;
          case 4:
            e2 = 1e4;
            break;
          default:
            e2 = 5e3;
        }
        e2 = c2 + e2;
        a2 = { id: u2++, callback: b2, priorityLevel: a2, startTime: c2, expirationTime: e2, sortIndex: -1 };
        c2 > d2 ? (a2.sortIndex = c2, f2(t2, a2), null === h2(r2) && a2 === h2(t2) && (B2 ? (E2(L2), L2 = -1) : B2 = true, K2(H2, c2 - d2))) : (a2.sortIndex = e2, f2(r2, a2), A2 || z2 || (A2 = true, I2(J2)));
        return a2;
      };
      exports$1.unstable_shouldYield = M2;
      exports$1.unstable_wrapCallback = function(a2) {
        var b2 = y2;
        return function() {
          var c2 = y2;
          y2 = b2;
          try {
            return a2.apply(this, arguments);
          } finally {
            y2 = c2;
          }
        };
      };
    })(scheduler_production_min);
    return scheduler_production_min;
  }
  var hasRequiredScheduler;
  function requireScheduler() {
    if (hasRequiredScheduler) return scheduler.exports;
    hasRequiredScheduler = 1;
    {
      scheduler.exports = requireScheduler_production_min();
    }
    return scheduler.exports;
  }
  var hasRequiredReactDom_production_min;
  function requireReactDom_production_min() {
    if (hasRequiredReactDom_production_min) return reactDom_production_min;
    hasRequiredReactDom_production_min = 1;
    var aa = requireReact(), ca = requireScheduler();
    function p2(a2) {
      for (var b2 = "https://reactjs.org/docs/error-decoder.html?invariant=" + a2, c2 = 1; c2 < arguments.length; c2++) b2 += "&args[]=" + encodeURIComponent(arguments[c2]);
      return "Minified React error #" + a2 + "; visit " + b2 + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
    }
    var da = /* @__PURE__ */ new Set(), ea = {};
    function fa(a2, b2) {
      ha(a2, b2);
      ha(a2 + "Capture", b2);
    }
    function ha(a2, b2) {
      ea[a2] = b2;
      for (a2 = 0; a2 < b2.length; a2++) da.add(b2[a2]);
    }
    var ia = !("undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement), ja = Object.prototype.hasOwnProperty, ka = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, la = {}, ma = {};
    function oa(a2) {
      if (ja.call(ma, a2)) return true;
      if (ja.call(la, a2)) return false;
      if (ka.test(a2)) return ma[a2] = true;
      la[a2] = true;
      return false;
    }
    function pa(a2, b2, c2, d2) {
      if (null !== c2 && 0 === c2.type) return false;
      switch (typeof b2) {
        case "function":
        case "symbol":
          return true;
        case "boolean":
          if (d2) return false;
          if (null !== c2) return !c2.acceptsBooleans;
          a2 = a2.toLowerCase().slice(0, 5);
          return "data-" !== a2 && "aria-" !== a2;
        default:
          return false;
      }
    }
    function qa(a2, b2, c2, d2) {
      if (null === b2 || "undefined" === typeof b2 || pa(a2, b2, c2, d2)) return true;
      if (d2) return false;
      if (null !== c2) switch (c2.type) {
        case 3:
          return !b2;
        case 4:
          return false === b2;
        case 5:
          return isNaN(b2);
        case 6:
          return isNaN(b2) || 1 > b2;
      }
      return false;
    }
    function v2(a2, b2, c2, d2, e2, f2, g2) {
      this.acceptsBooleans = 2 === b2 || 3 === b2 || 4 === b2;
      this.attributeName = d2;
      this.attributeNamespace = e2;
      this.mustUseProperty = c2;
      this.propertyName = a2;
      this.type = b2;
      this.sanitizeURL = f2;
      this.removeEmptyString = g2;
    }
    var z2 = {};
    "children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(a2) {
      z2[a2] = new v2(a2, 0, false, a2, null, false, false);
    });
    [["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(a2) {
      var b2 = a2[0];
      z2[b2] = new v2(b2, 1, false, a2[1], null, false, false);
    });
    ["contentEditable", "draggable", "spellCheck", "value"].forEach(function(a2) {
      z2[a2] = new v2(a2, 2, false, a2.toLowerCase(), null, false, false);
    });
    ["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(a2) {
      z2[a2] = new v2(a2, 2, false, a2, null, false, false);
    });
    "allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(a2) {
      z2[a2] = new v2(a2, 3, false, a2.toLowerCase(), null, false, false);
    });
    ["checked", "multiple", "muted", "selected"].forEach(function(a2) {
      z2[a2] = new v2(a2, 3, true, a2, null, false, false);
    });
    ["capture", "download"].forEach(function(a2) {
      z2[a2] = new v2(a2, 4, false, a2, null, false, false);
    });
    ["cols", "rows", "size", "span"].forEach(function(a2) {
      z2[a2] = new v2(a2, 6, false, a2, null, false, false);
    });
    ["rowSpan", "start"].forEach(function(a2) {
      z2[a2] = new v2(a2, 5, false, a2.toLowerCase(), null, false, false);
    });
    var ra = /[\-:]([a-z])/g;
    function sa(a2) {
      return a2[1].toUpperCase();
    }
    "accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(a2) {
      var b2 = a2.replace(
        ra,
        sa
      );
      z2[b2] = new v2(b2, 1, false, a2, null, false, false);
    });
    "xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(a2) {
      var b2 = a2.replace(ra, sa);
      z2[b2] = new v2(b2, 1, false, a2, "http://www.w3.org/1999/xlink", false, false);
    });
    ["xml:base", "xml:lang", "xml:space"].forEach(function(a2) {
      var b2 = a2.replace(ra, sa);
      z2[b2] = new v2(b2, 1, false, a2, "http://www.w3.org/XML/1998/namespace", false, false);
    });
    ["tabIndex", "crossOrigin"].forEach(function(a2) {
      z2[a2] = new v2(a2, 1, false, a2.toLowerCase(), null, false, false);
    });
    z2.xlinkHref = new v2("xlinkHref", 1, false, "xlink:href", "http://www.w3.org/1999/xlink", true, false);
    ["src", "href", "action", "formAction"].forEach(function(a2) {
      z2[a2] = new v2(a2, 1, false, a2.toLowerCase(), null, true, true);
    });
    function ta(a2, b2, c2, d2) {
      var e2 = z2.hasOwnProperty(b2) ? z2[b2] : null;
      if (null !== e2 ? 0 !== e2.type : d2 || !(2 < b2.length) || "o" !== b2[0] && "O" !== b2[0] || "n" !== b2[1] && "N" !== b2[1]) qa(b2, c2, e2, d2) && (c2 = null), d2 || null === e2 ? oa(b2) && (null === c2 ? a2.removeAttribute(b2) : a2.setAttribute(b2, "" + c2)) : e2.mustUseProperty ? a2[e2.propertyName] = null === c2 ? 3 === e2.type ? false : "" : c2 : (b2 = e2.attributeName, d2 = e2.attributeNamespace, null === c2 ? a2.removeAttribute(b2) : (e2 = e2.type, c2 = 3 === e2 || 4 === e2 && true === c2 ? "" : "" + c2, d2 ? a2.setAttributeNS(d2, b2, c2) : a2.setAttribute(b2, c2)));
    }
    var ua = aa.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, va = Symbol.for("react.element"), wa = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), za = Symbol.for("react.strict_mode"), Aa = Symbol.for("react.profiler"), Ba = Symbol.for("react.provider"), Ca = Symbol.for("react.context"), Da = Symbol.for("react.forward_ref"), Ea = Symbol.for("react.suspense"), Fa = Symbol.for("react.suspense_list"), Ga = Symbol.for("react.memo"), Ha = Symbol.for("react.lazy");
    var Ia = Symbol.for("react.offscreen");
    var Ja = Symbol.iterator;
    function Ka(a2) {
      if (null === a2 || "object" !== typeof a2) return null;
      a2 = Ja && a2[Ja] || a2["@@iterator"];
      return "function" === typeof a2 ? a2 : null;
    }
    var A2 = Object.assign, La;
    function Ma(a2) {
      if (void 0 === La) try {
        throw Error();
      } catch (c2) {
        var b2 = c2.stack.trim().match(/\n( *(at )?)/);
        La = b2 && b2[1] || "";
      }
      return "\n" + La + a2;
    }
    var Na = false;
    function Oa(a2, b2) {
      if (!a2 || Na) return "";
      Na = true;
      var c2 = Error.prepareStackTrace;
      Error.prepareStackTrace = void 0;
      try {
        if (b2) if (b2 = function() {
          throw Error();
        }, Object.defineProperty(b2.prototype, "props", { set: function() {
          throw Error();
        } }), "object" === typeof Reflect && Reflect.construct) {
          try {
            Reflect.construct(b2, []);
          } catch (l2) {
            var d2 = l2;
          }
          Reflect.construct(a2, [], b2);
        } else {
          try {
            b2.call();
          } catch (l2) {
            d2 = l2;
          }
          a2.call(b2.prototype);
        }
        else {
          try {
            throw Error();
          } catch (l2) {
            d2 = l2;
          }
          a2();
        }
      } catch (l2) {
        if (l2 && d2 && "string" === typeof l2.stack) {
          for (var e2 = l2.stack.split("\n"), f2 = d2.stack.split("\n"), g2 = e2.length - 1, h2 = f2.length - 1; 1 <= g2 && 0 <= h2 && e2[g2] !== f2[h2]; ) h2--;
          for (; 1 <= g2 && 0 <= h2; g2--, h2--) if (e2[g2] !== f2[h2]) {
            if (1 !== g2 || 1 !== h2) {
              do
                if (g2--, h2--, 0 > h2 || e2[g2] !== f2[h2]) {
                  var k2 = "\n" + e2[g2].replace(" at new ", " at ");
                  a2.displayName && k2.includes("<anonymous>") && (k2 = k2.replace("<anonymous>", a2.displayName));
                  return k2;
                }
              while (1 <= g2 && 0 <= h2);
            }
            break;
          }
        }
      } finally {
        Na = false, Error.prepareStackTrace = c2;
      }
      return (a2 = a2 ? a2.displayName || a2.name : "") ? Ma(a2) : "";
    }
    function Pa(a2) {
      switch (a2.tag) {
        case 5:
          return Ma(a2.type);
        case 16:
          return Ma("Lazy");
        case 13:
          return Ma("Suspense");
        case 19:
          return Ma("SuspenseList");
        case 0:
        case 2:
        case 15:
          return a2 = Oa(a2.type, false), a2;
        case 11:
          return a2 = Oa(a2.type.render, false), a2;
        case 1:
          return a2 = Oa(a2.type, true), a2;
        default:
          return "";
      }
    }
    function Qa(a2) {
      if (null == a2) return null;
      if ("function" === typeof a2) return a2.displayName || a2.name || null;
      if ("string" === typeof a2) return a2;
      switch (a2) {
        case ya:
          return "Fragment";
        case wa:
          return "Portal";
        case Aa:
          return "Profiler";
        case za:
          return "StrictMode";
        case Ea:
          return "Suspense";
        case Fa:
          return "SuspenseList";
      }
      if ("object" === typeof a2) switch (a2.$$typeof) {
        case Ca:
          return (a2.displayName || "Context") + ".Consumer";
        case Ba:
          return (a2._context.displayName || "Context") + ".Provider";
        case Da:
          var b2 = a2.render;
          a2 = a2.displayName;
          a2 || (a2 = b2.displayName || b2.name || "", a2 = "" !== a2 ? "ForwardRef(" + a2 + ")" : "ForwardRef");
          return a2;
        case Ga:
          return b2 = a2.displayName || null, null !== b2 ? b2 : Qa(a2.type) || "Memo";
        case Ha:
          b2 = a2._payload;
          a2 = a2._init;
          try {
            return Qa(a2(b2));
          } catch (c2) {
          }
      }
      return null;
    }
    function Ra(a2) {
      var b2 = a2.type;
      switch (a2.tag) {
        case 24:
          return "Cache";
        case 9:
          return (b2.displayName || "Context") + ".Consumer";
        case 10:
          return (b2._context.displayName || "Context") + ".Provider";
        case 18:
          return "DehydratedFragment";
        case 11:
          return a2 = b2.render, a2 = a2.displayName || a2.name || "", b2.displayName || ("" !== a2 ? "ForwardRef(" + a2 + ")" : "ForwardRef");
        case 7:
          return "Fragment";
        case 5:
          return b2;
        case 4:
          return "Portal";
        case 3:
          return "Root";
        case 6:
          return "Text";
        case 16:
          return Qa(b2);
        case 8:
          return b2 === za ? "StrictMode" : "Mode";
        case 22:
          return "Offscreen";
        case 12:
          return "Profiler";
        case 21:
          return "Scope";
        case 13:
          return "Suspense";
        case 19:
          return "SuspenseList";
        case 25:
          return "TracingMarker";
        case 1:
        case 0:
        case 17:
        case 2:
        case 14:
        case 15:
          if ("function" === typeof b2) return b2.displayName || b2.name || null;
          if ("string" === typeof b2) return b2;
      }
      return null;
    }
    function Sa(a2) {
      switch (typeof a2) {
        case "boolean":
        case "number":
        case "string":
        case "undefined":
          return a2;
        case "object":
          return a2;
        default:
          return "";
      }
    }
    function Ta(a2) {
      var b2 = a2.type;
      return (a2 = a2.nodeName) && "input" === a2.toLowerCase() && ("checkbox" === b2 || "radio" === b2);
    }
    function Ua(a2) {
      var b2 = Ta(a2) ? "checked" : "value", c2 = Object.getOwnPropertyDescriptor(a2.constructor.prototype, b2), d2 = "" + a2[b2];
      if (!a2.hasOwnProperty(b2) && "undefined" !== typeof c2 && "function" === typeof c2.get && "function" === typeof c2.set) {
        var e2 = c2.get, f2 = c2.set;
        Object.defineProperty(a2, b2, { configurable: true, get: function() {
          return e2.call(this);
        }, set: function(a3) {
          d2 = "" + a3;
          f2.call(this, a3);
        } });
        Object.defineProperty(a2, b2, { enumerable: c2.enumerable });
        return { getValue: function() {
          return d2;
        }, setValue: function(a3) {
          d2 = "" + a3;
        }, stopTracking: function() {
          a2._valueTracker = null;
          delete a2[b2];
        } };
      }
    }
    function Va(a2) {
      a2._valueTracker || (a2._valueTracker = Ua(a2));
    }
    function Wa(a2) {
      if (!a2) return false;
      var b2 = a2._valueTracker;
      if (!b2) return true;
      var c2 = b2.getValue();
      var d2 = "";
      a2 && (d2 = Ta(a2) ? a2.checked ? "true" : "false" : a2.value);
      a2 = d2;
      return a2 !== c2 ? (b2.setValue(a2), true) : false;
    }
    function Xa(a2) {
      a2 = a2 || ("undefined" !== typeof document ? document : void 0);
      if ("undefined" === typeof a2) return null;
      try {
        return a2.activeElement || a2.body;
      } catch (b2) {
        return a2.body;
      }
    }
    function Ya(a2, b2) {
      var c2 = b2.checked;
      return A2({}, b2, { defaultChecked: void 0, defaultValue: void 0, value: void 0, checked: null != c2 ? c2 : a2._wrapperState.initialChecked });
    }
    function Za(a2, b2) {
      var c2 = null == b2.defaultValue ? "" : b2.defaultValue, d2 = null != b2.checked ? b2.checked : b2.defaultChecked;
      c2 = Sa(null != b2.value ? b2.value : c2);
      a2._wrapperState = { initialChecked: d2, initialValue: c2, controlled: "checkbox" === b2.type || "radio" === b2.type ? null != b2.checked : null != b2.value };
    }
    function ab(a2, b2) {
      b2 = b2.checked;
      null != b2 && ta(a2, "checked", b2, false);
    }
    function bb(a2, b2) {
      ab(a2, b2);
      var c2 = Sa(b2.value), d2 = b2.type;
      if (null != c2) if ("number" === d2) {
        if (0 === c2 && "" === a2.value || a2.value != c2) a2.value = "" + c2;
      } else a2.value !== "" + c2 && (a2.value = "" + c2);
      else if ("submit" === d2 || "reset" === d2) {
        a2.removeAttribute("value");
        return;
      }
      b2.hasOwnProperty("value") ? cb(a2, b2.type, c2) : b2.hasOwnProperty("defaultValue") && cb(a2, b2.type, Sa(b2.defaultValue));
      null == b2.checked && null != b2.defaultChecked && (a2.defaultChecked = !!b2.defaultChecked);
    }
    function db(a2, b2, c2) {
      if (b2.hasOwnProperty("value") || b2.hasOwnProperty("defaultValue")) {
        var d2 = b2.type;
        if (!("submit" !== d2 && "reset" !== d2 || void 0 !== b2.value && null !== b2.value)) return;
        b2 = "" + a2._wrapperState.initialValue;
        c2 || b2 === a2.value || (a2.value = b2);
        a2.defaultValue = b2;
      }
      c2 = a2.name;
      "" !== c2 && (a2.name = "");
      a2.defaultChecked = !!a2._wrapperState.initialChecked;
      "" !== c2 && (a2.name = c2);
    }
    function cb(a2, b2, c2) {
      if ("number" !== b2 || Xa(a2.ownerDocument) !== a2) null == c2 ? a2.defaultValue = "" + a2._wrapperState.initialValue : a2.defaultValue !== "" + c2 && (a2.defaultValue = "" + c2);
    }
    var eb = Array.isArray;
    function fb(a2, b2, c2, d2) {
      a2 = a2.options;
      if (b2) {
        b2 = {};
        for (var e2 = 0; e2 < c2.length; e2++) b2["$" + c2[e2]] = true;
        for (c2 = 0; c2 < a2.length; c2++) e2 = b2.hasOwnProperty("$" + a2[c2].value), a2[c2].selected !== e2 && (a2[c2].selected = e2), e2 && d2 && (a2[c2].defaultSelected = true);
      } else {
        c2 = "" + Sa(c2);
        b2 = null;
        for (e2 = 0; e2 < a2.length; e2++) {
          if (a2[e2].value === c2) {
            a2[e2].selected = true;
            d2 && (a2[e2].defaultSelected = true);
            return;
          }
          null !== b2 || a2[e2].disabled || (b2 = a2[e2]);
        }
        null !== b2 && (b2.selected = true);
      }
    }
    function gb(a2, b2) {
      if (null != b2.dangerouslySetInnerHTML) throw Error(p2(91));
      return A2({}, b2, { value: void 0, defaultValue: void 0, children: "" + a2._wrapperState.initialValue });
    }
    function hb(a2, b2) {
      var c2 = b2.value;
      if (null == c2) {
        c2 = b2.children;
        b2 = b2.defaultValue;
        if (null != c2) {
          if (null != b2) throw Error(p2(92));
          if (eb(c2)) {
            if (1 < c2.length) throw Error(p2(93));
            c2 = c2[0];
          }
          b2 = c2;
        }
        null == b2 && (b2 = "");
        c2 = b2;
      }
      a2._wrapperState = { initialValue: Sa(c2) };
    }
    function ib(a2, b2) {
      var c2 = Sa(b2.value), d2 = Sa(b2.defaultValue);
      null != c2 && (c2 = "" + c2, c2 !== a2.value && (a2.value = c2), null == b2.defaultValue && a2.defaultValue !== c2 && (a2.defaultValue = c2));
      null != d2 && (a2.defaultValue = "" + d2);
    }
    function jb(a2) {
      var b2 = a2.textContent;
      b2 === a2._wrapperState.initialValue && "" !== b2 && null !== b2 && (a2.value = b2);
    }
    function kb(a2) {
      switch (a2) {
        case "svg":
          return "http://www.w3.org/2000/svg";
        case "math":
          return "http://www.w3.org/1998/Math/MathML";
        default:
          return "http://www.w3.org/1999/xhtml";
      }
    }
    function lb(a2, b2) {
      return null == a2 || "http://www.w3.org/1999/xhtml" === a2 ? kb(b2) : "http://www.w3.org/2000/svg" === a2 && "foreignObject" === b2 ? "http://www.w3.org/1999/xhtml" : a2;
    }
    var mb, nb = (function(a2) {
      return "undefined" !== typeof MSApp && MSApp.execUnsafeLocalFunction ? function(b2, c2, d2, e2) {
        MSApp.execUnsafeLocalFunction(function() {
          return a2(b2, c2, d2, e2);
        });
      } : a2;
    })(function(a2, b2) {
      if ("http://www.w3.org/2000/svg" !== a2.namespaceURI || "innerHTML" in a2) a2.innerHTML = b2;
      else {
        mb = mb || document.createElement("div");
        mb.innerHTML = "<svg>" + b2.valueOf().toString() + "</svg>";
        for (b2 = mb.firstChild; a2.firstChild; ) a2.removeChild(a2.firstChild);
        for (; b2.firstChild; ) a2.appendChild(b2.firstChild);
      }
    });
    function ob(a2, b2) {
      if (b2) {
        var c2 = a2.firstChild;
        if (c2 && c2 === a2.lastChild && 3 === c2.nodeType) {
          c2.nodeValue = b2;
          return;
        }
      }
      a2.textContent = b2;
    }
    var pb = {
      animationIterationCount: true,
      aspectRatio: true,
      borderImageOutset: true,
      borderImageSlice: true,
      borderImageWidth: true,
      boxFlex: true,
      boxFlexGroup: true,
      boxOrdinalGroup: true,
      columnCount: true,
      columns: true,
      flex: true,
      flexGrow: true,
      flexPositive: true,
      flexShrink: true,
      flexNegative: true,
      flexOrder: true,
      gridArea: true,
      gridRow: true,
      gridRowEnd: true,
      gridRowSpan: true,
      gridRowStart: true,
      gridColumn: true,
      gridColumnEnd: true,
      gridColumnSpan: true,
      gridColumnStart: true,
      fontWeight: true,
      lineClamp: true,
      lineHeight: true,
      opacity: true,
      order: true,
      orphans: true,
      tabSize: true,
      widows: true,
      zIndex: true,
      zoom: true,
      fillOpacity: true,
      floodOpacity: true,
      stopOpacity: true,
      strokeDasharray: true,
      strokeDashoffset: true,
      strokeMiterlimit: true,
      strokeOpacity: true,
      strokeWidth: true
    }, qb = ["Webkit", "ms", "Moz", "O"];
    Object.keys(pb).forEach(function(a2) {
      qb.forEach(function(b2) {
        b2 = b2 + a2.charAt(0).toUpperCase() + a2.substring(1);
        pb[b2] = pb[a2];
      });
    });
    function rb(a2, b2, c2) {
      return null == b2 || "boolean" === typeof b2 || "" === b2 ? "" : c2 || "number" !== typeof b2 || 0 === b2 || pb.hasOwnProperty(a2) && pb[a2] ? ("" + b2).trim() : b2 + "px";
    }
    function sb(a2, b2) {
      a2 = a2.style;
      for (var c2 in b2) if (b2.hasOwnProperty(c2)) {
        var d2 = 0 === c2.indexOf("--"), e2 = rb(c2, b2[c2], d2);
        "float" === c2 && (c2 = "cssFloat");
        d2 ? a2.setProperty(c2, e2) : a2[c2] = e2;
      }
    }
    var tb = A2({ menuitem: true }, { area: true, base: true, br: true, col: true, embed: true, hr: true, img: true, input: true, keygen: true, link: true, meta: true, param: true, source: true, track: true, wbr: true });
    function ub(a2, b2) {
      if (b2) {
        if (tb[a2] && (null != b2.children || null != b2.dangerouslySetInnerHTML)) throw Error(p2(137, a2));
        if (null != b2.dangerouslySetInnerHTML) {
          if (null != b2.children) throw Error(p2(60));
          if ("object" !== typeof b2.dangerouslySetInnerHTML || !("__html" in b2.dangerouslySetInnerHTML)) throw Error(p2(61));
        }
        if (null != b2.style && "object" !== typeof b2.style) throw Error(p2(62));
      }
    }
    function vb(a2, b2) {
      if (-1 === a2.indexOf("-")) return "string" === typeof b2.is;
      switch (a2) {
        case "annotation-xml":
        case "color-profile":
        case "font-face":
        case "font-face-src":
        case "font-face-uri":
        case "font-face-format":
        case "font-face-name":
        case "missing-glyph":
          return false;
        default:
          return true;
      }
    }
    var wb = null;
    function xb(a2) {
      a2 = a2.target || a2.srcElement || window;
      a2.correspondingUseElement && (a2 = a2.correspondingUseElement);
      return 3 === a2.nodeType ? a2.parentNode : a2;
    }
    var yb = null, zb = null, Ab = null;
    function Bb(a2) {
      if (a2 = Cb(a2)) {
        if ("function" !== typeof yb) throw Error(p2(280));
        var b2 = a2.stateNode;
        b2 && (b2 = Db(b2), yb(a2.stateNode, a2.type, b2));
      }
    }
    function Eb(a2) {
      zb ? Ab ? Ab.push(a2) : Ab = [a2] : zb = a2;
    }
    function Fb() {
      if (zb) {
        var a2 = zb, b2 = Ab;
        Ab = zb = null;
        Bb(a2);
        if (b2) for (a2 = 0; a2 < b2.length; a2++) Bb(b2[a2]);
      }
    }
    function Gb(a2, b2) {
      return a2(b2);
    }
    function Hb() {
    }
    var Ib = false;
    function Jb(a2, b2, c2) {
      if (Ib) return a2(b2, c2);
      Ib = true;
      try {
        return Gb(a2, b2, c2);
      } finally {
        if (Ib = false, null !== zb || null !== Ab) Hb(), Fb();
      }
    }
    function Kb(a2, b2) {
      var c2 = a2.stateNode;
      if (null === c2) return null;
      var d2 = Db(c2);
      if (null === d2) return null;
      c2 = d2[b2];
      a: switch (b2) {
        case "onClick":
        case "onClickCapture":
        case "onDoubleClick":
        case "onDoubleClickCapture":
        case "onMouseDown":
        case "onMouseDownCapture":
        case "onMouseMove":
        case "onMouseMoveCapture":
        case "onMouseUp":
        case "onMouseUpCapture":
        case "onMouseEnter":
          (d2 = !d2.disabled) || (a2 = a2.type, d2 = !("button" === a2 || "input" === a2 || "select" === a2 || "textarea" === a2));
          a2 = !d2;
          break a;
        default:
          a2 = false;
      }
      if (a2) return null;
      if (c2 && "function" !== typeof c2) throw Error(p2(231, b2, typeof c2));
      return c2;
    }
    var Lb = false;
    if (ia) try {
      var Mb = {};
      Object.defineProperty(Mb, "passive", { get: function() {
        Lb = true;
      } });
      window.addEventListener("test", Mb, Mb);
      window.removeEventListener("test", Mb, Mb);
    } catch (a2) {
      Lb = false;
    }
    function Nb(a2, b2, c2, d2, e2, f2, g2, h2, k2) {
      var l2 = Array.prototype.slice.call(arguments, 3);
      try {
        b2.apply(c2, l2);
      } catch (m2) {
        this.onError(m2);
      }
    }
    var Ob = false, Pb = null, Qb = false, Rb = null, Sb = { onError: function(a2) {
      Ob = true;
      Pb = a2;
    } };
    function Tb(a2, b2, c2, d2, e2, f2, g2, h2, k2) {
      Ob = false;
      Pb = null;
      Nb.apply(Sb, arguments);
    }
    function Ub(a2, b2, c2, d2, e2, f2, g2, h2, k2) {
      Tb.apply(this, arguments);
      if (Ob) {
        if (Ob) {
          var l2 = Pb;
          Ob = false;
          Pb = null;
        } else throw Error(p2(198));
        Qb || (Qb = true, Rb = l2);
      }
    }
    function Vb(a2) {
      var b2 = a2, c2 = a2;
      if (a2.alternate) for (; b2.return; ) b2 = b2.return;
      else {
        a2 = b2;
        do
          b2 = a2, 0 !== (b2.flags & 4098) && (c2 = b2.return), a2 = b2.return;
        while (a2);
      }
      return 3 === b2.tag ? c2 : null;
    }
    function Wb(a2) {
      if (13 === a2.tag) {
        var b2 = a2.memoizedState;
        null === b2 && (a2 = a2.alternate, null !== a2 && (b2 = a2.memoizedState));
        if (null !== b2) return b2.dehydrated;
      }
      return null;
    }
    function Xb(a2) {
      if (Vb(a2) !== a2) throw Error(p2(188));
    }
    function Yb(a2) {
      var b2 = a2.alternate;
      if (!b2) {
        b2 = Vb(a2);
        if (null === b2) throw Error(p2(188));
        return b2 !== a2 ? null : a2;
      }
      for (var c2 = a2, d2 = b2; ; ) {
        var e2 = c2.return;
        if (null === e2) break;
        var f2 = e2.alternate;
        if (null === f2) {
          d2 = e2.return;
          if (null !== d2) {
            c2 = d2;
            continue;
          }
          break;
        }
        if (e2.child === f2.child) {
          for (f2 = e2.child; f2; ) {
            if (f2 === c2) return Xb(e2), a2;
            if (f2 === d2) return Xb(e2), b2;
            f2 = f2.sibling;
          }
          throw Error(p2(188));
        }
        if (c2.return !== d2.return) c2 = e2, d2 = f2;
        else {
          for (var g2 = false, h2 = e2.child; h2; ) {
            if (h2 === c2) {
              g2 = true;
              c2 = e2;
              d2 = f2;
              break;
            }
            if (h2 === d2) {
              g2 = true;
              d2 = e2;
              c2 = f2;
              break;
            }
            h2 = h2.sibling;
          }
          if (!g2) {
            for (h2 = f2.child; h2; ) {
              if (h2 === c2) {
                g2 = true;
                c2 = f2;
                d2 = e2;
                break;
              }
              if (h2 === d2) {
                g2 = true;
                d2 = f2;
                c2 = e2;
                break;
              }
              h2 = h2.sibling;
            }
            if (!g2) throw Error(p2(189));
          }
        }
        if (c2.alternate !== d2) throw Error(p2(190));
      }
      if (3 !== c2.tag) throw Error(p2(188));
      return c2.stateNode.current === c2 ? a2 : b2;
    }
    function Zb(a2) {
      a2 = Yb(a2);
      return null !== a2 ? $b(a2) : null;
    }
    function $b(a2) {
      if (5 === a2.tag || 6 === a2.tag) return a2;
      for (a2 = a2.child; null !== a2; ) {
        var b2 = $b(a2);
        if (null !== b2) return b2;
        a2 = a2.sibling;
      }
      return null;
    }
    var ac = ca.unstable_scheduleCallback, bc = ca.unstable_cancelCallback, cc = ca.unstable_shouldYield, dc = ca.unstable_requestPaint, B2 = ca.unstable_now, ec = ca.unstable_getCurrentPriorityLevel, fc = ca.unstable_ImmediatePriority, gc = ca.unstable_UserBlockingPriority, hc = ca.unstable_NormalPriority, ic = ca.unstable_LowPriority, jc = ca.unstable_IdlePriority, kc = null, lc = null;
    function mc(a2) {
      if (lc && "function" === typeof lc.onCommitFiberRoot) try {
        lc.onCommitFiberRoot(kc, a2, void 0, 128 === (a2.current.flags & 128));
      } catch (b2) {
      }
    }
    var oc = Math.clz32 ? Math.clz32 : nc, pc = Math.log, qc = Math.LN2;
    function nc(a2) {
      a2 >>>= 0;
      return 0 === a2 ? 32 : 31 - (pc(a2) / qc | 0) | 0;
    }
    var rc = 64, sc = 4194304;
    function tc(a2) {
      switch (a2 & -a2) {
        case 1:
          return 1;
        case 2:
          return 2;
        case 4:
          return 4;
        case 8:
          return 8;
        case 16:
          return 16;
        case 32:
          return 32;
        case 64:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
          return a2 & 4194240;
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
        case 67108864:
          return a2 & 130023424;
        case 134217728:
          return 134217728;
        case 268435456:
          return 268435456;
        case 536870912:
          return 536870912;
        case 1073741824:
          return 1073741824;
        default:
          return a2;
      }
    }
    function uc(a2, b2) {
      var c2 = a2.pendingLanes;
      if (0 === c2) return 0;
      var d2 = 0, e2 = a2.suspendedLanes, f2 = a2.pingedLanes, g2 = c2 & 268435455;
      if (0 !== g2) {
        var h2 = g2 & ~e2;
        0 !== h2 ? d2 = tc(h2) : (f2 &= g2, 0 !== f2 && (d2 = tc(f2)));
      } else g2 = c2 & ~e2, 0 !== g2 ? d2 = tc(g2) : 0 !== f2 && (d2 = tc(f2));
      if (0 === d2) return 0;
      if (0 !== b2 && b2 !== d2 && 0 === (b2 & e2) && (e2 = d2 & -d2, f2 = b2 & -b2, e2 >= f2 || 16 === e2 && 0 !== (f2 & 4194240))) return b2;
      0 !== (d2 & 4) && (d2 |= c2 & 16);
      b2 = a2.entangledLanes;
      if (0 !== b2) for (a2 = a2.entanglements, b2 &= d2; 0 < b2; ) c2 = 31 - oc(b2), e2 = 1 << c2, d2 |= a2[c2], b2 &= ~e2;
      return d2;
    }
    function vc(a2, b2) {
      switch (a2) {
        case 1:
        case 2:
        case 4:
          return b2 + 250;
        case 8:
        case 16:
        case 32:
        case 64:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
          return b2 + 5e3;
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
        case 67108864:
          return -1;
        case 134217728:
        case 268435456:
        case 536870912:
        case 1073741824:
          return -1;
        default:
          return -1;
      }
    }
    function wc(a2, b2) {
      for (var c2 = a2.suspendedLanes, d2 = a2.pingedLanes, e2 = a2.expirationTimes, f2 = a2.pendingLanes; 0 < f2; ) {
        var g2 = 31 - oc(f2), h2 = 1 << g2, k2 = e2[g2];
        if (-1 === k2) {
          if (0 === (h2 & c2) || 0 !== (h2 & d2)) e2[g2] = vc(h2, b2);
        } else k2 <= b2 && (a2.expiredLanes |= h2);
        f2 &= ~h2;
      }
    }
    function xc(a2) {
      a2 = a2.pendingLanes & -1073741825;
      return 0 !== a2 ? a2 : a2 & 1073741824 ? 1073741824 : 0;
    }
    function yc() {
      var a2 = rc;
      rc <<= 1;
      0 === (rc & 4194240) && (rc = 64);
      return a2;
    }
    function zc(a2) {
      for (var b2 = [], c2 = 0; 31 > c2; c2++) b2.push(a2);
      return b2;
    }
    function Ac(a2, b2, c2) {
      a2.pendingLanes |= b2;
      536870912 !== b2 && (a2.suspendedLanes = 0, a2.pingedLanes = 0);
      a2 = a2.eventTimes;
      b2 = 31 - oc(b2);
      a2[b2] = c2;
    }
    function Bc(a2, b2) {
      var c2 = a2.pendingLanes & ~b2;
      a2.pendingLanes = b2;
      a2.suspendedLanes = 0;
      a2.pingedLanes = 0;
      a2.expiredLanes &= b2;
      a2.mutableReadLanes &= b2;
      a2.entangledLanes &= b2;
      b2 = a2.entanglements;
      var d2 = a2.eventTimes;
      for (a2 = a2.expirationTimes; 0 < c2; ) {
        var e2 = 31 - oc(c2), f2 = 1 << e2;
        b2[e2] = 0;
        d2[e2] = -1;
        a2[e2] = -1;
        c2 &= ~f2;
      }
    }
    function Cc(a2, b2) {
      var c2 = a2.entangledLanes |= b2;
      for (a2 = a2.entanglements; c2; ) {
        var d2 = 31 - oc(c2), e2 = 1 << d2;
        e2 & b2 | a2[d2] & b2 && (a2[d2] |= b2);
        c2 &= ~e2;
      }
    }
    var C2 = 0;
    function Dc(a2) {
      a2 &= -a2;
      return 1 < a2 ? 4 < a2 ? 0 !== (a2 & 268435455) ? 16 : 536870912 : 4 : 1;
    }
    var Ec, Fc, Gc, Hc, Ic, Jc = false, Kc = [], Lc = null, Mc = null, Nc = null, Oc = /* @__PURE__ */ new Map(), Pc = /* @__PURE__ */ new Map(), Qc = [], Rc = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
    function Sc(a2, b2) {
      switch (a2) {
        case "focusin":
        case "focusout":
          Lc = null;
          break;
        case "dragenter":
        case "dragleave":
          Mc = null;
          break;
        case "mouseover":
        case "mouseout":
          Nc = null;
          break;
        case "pointerover":
        case "pointerout":
          Oc.delete(b2.pointerId);
          break;
        case "gotpointercapture":
        case "lostpointercapture":
          Pc.delete(b2.pointerId);
      }
    }
    function Tc(a2, b2, c2, d2, e2, f2) {
      if (null === a2 || a2.nativeEvent !== f2) return a2 = { blockedOn: b2, domEventName: c2, eventSystemFlags: d2, nativeEvent: f2, targetContainers: [e2] }, null !== b2 && (b2 = Cb(b2), null !== b2 && Fc(b2)), a2;
      a2.eventSystemFlags |= d2;
      b2 = a2.targetContainers;
      null !== e2 && -1 === b2.indexOf(e2) && b2.push(e2);
      return a2;
    }
    function Uc(a2, b2, c2, d2, e2) {
      switch (b2) {
        case "focusin":
          return Lc = Tc(Lc, a2, b2, c2, d2, e2), true;
        case "dragenter":
          return Mc = Tc(Mc, a2, b2, c2, d2, e2), true;
        case "mouseover":
          return Nc = Tc(Nc, a2, b2, c2, d2, e2), true;
        case "pointerover":
          var f2 = e2.pointerId;
          Oc.set(f2, Tc(Oc.get(f2) || null, a2, b2, c2, d2, e2));
          return true;
        case "gotpointercapture":
          return f2 = e2.pointerId, Pc.set(f2, Tc(Pc.get(f2) || null, a2, b2, c2, d2, e2)), true;
      }
      return false;
    }
    function Vc(a2) {
      var b2 = Wc(a2.target);
      if (null !== b2) {
        var c2 = Vb(b2);
        if (null !== c2) {
          if (b2 = c2.tag, 13 === b2) {
            if (b2 = Wb(c2), null !== b2) {
              a2.blockedOn = b2;
              Ic(a2.priority, function() {
                Gc(c2);
              });
              return;
            }
          } else if (3 === b2 && c2.stateNode.current.memoizedState.isDehydrated) {
            a2.blockedOn = 3 === c2.tag ? c2.stateNode.containerInfo : null;
            return;
          }
        }
      }
      a2.blockedOn = null;
    }
    function Xc(a2) {
      if (null !== a2.blockedOn) return false;
      for (var b2 = a2.targetContainers; 0 < b2.length; ) {
        var c2 = Yc(a2.domEventName, a2.eventSystemFlags, b2[0], a2.nativeEvent);
        if (null === c2) {
          c2 = a2.nativeEvent;
          var d2 = new c2.constructor(c2.type, c2);
          wb = d2;
          c2.target.dispatchEvent(d2);
          wb = null;
        } else return b2 = Cb(c2), null !== b2 && Fc(b2), a2.blockedOn = c2, false;
        b2.shift();
      }
      return true;
    }
    function Zc(a2, b2, c2) {
      Xc(a2) && c2.delete(b2);
    }
    function $c() {
      Jc = false;
      null !== Lc && Xc(Lc) && (Lc = null);
      null !== Mc && Xc(Mc) && (Mc = null);
      null !== Nc && Xc(Nc) && (Nc = null);
      Oc.forEach(Zc);
      Pc.forEach(Zc);
    }
    function ad(a2, b2) {
      a2.blockedOn === b2 && (a2.blockedOn = null, Jc || (Jc = true, ca.unstable_scheduleCallback(ca.unstable_NormalPriority, $c)));
    }
    function bd(a2) {
      function b2(b3) {
        return ad(b3, a2);
      }
      if (0 < Kc.length) {
        ad(Kc[0], a2);
        for (var c2 = 1; c2 < Kc.length; c2++) {
          var d2 = Kc[c2];
          d2.blockedOn === a2 && (d2.blockedOn = null);
        }
      }
      null !== Lc && ad(Lc, a2);
      null !== Mc && ad(Mc, a2);
      null !== Nc && ad(Nc, a2);
      Oc.forEach(b2);
      Pc.forEach(b2);
      for (c2 = 0; c2 < Qc.length; c2++) d2 = Qc[c2], d2.blockedOn === a2 && (d2.blockedOn = null);
      for (; 0 < Qc.length && (c2 = Qc[0], null === c2.blockedOn); ) Vc(c2), null === c2.blockedOn && Qc.shift();
    }
    var cd = ua.ReactCurrentBatchConfig, dd = true;
    function ed(a2, b2, c2, d2) {
      var e2 = C2, f2 = cd.transition;
      cd.transition = null;
      try {
        C2 = 1, fd(a2, b2, c2, d2);
      } finally {
        C2 = e2, cd.transition = f2;
      }
    }
    function gd(a2, b2, c2, d2) {
      var e2 = C2, f2 = cd.transition;
      cd.transition = null;
      try {
        C2 = 4, fd(a2, b2, c2, d2);
      } finally {
        C2 = e2, cd.transition = f2;
      }
    }
    function fd(a2, b2, c2, d2) {
      if (dd) {
        var e2 = Yc(a2, b2, c2, d2);
        if (null === e2) hd(a2, b2, d2, id, c2), Sc(a2, d2);
        else if (Uc(e2, a2, b2, c2, d2)) d2.stopPropagation();
        else if (Sc(a2, d2), b2 & 4 && -1 < Rc.indexOf(a2)) {
          for (; null !== e2; ) {
            var f2 = Cb(e2);
            null !== f2 && Ec(f2);
            f2 = Yc(a2, b2, c2, d2);
            null === f2 && hd(a2, b2, d2, id, c2);
            if (f2 === e2) break;
            e2 = f2;
          }
          null !== e2 && d2.stopPropagation();
        } else hd(a2, b2, d2, null, c2);
      }
    }
    var id = null;
    function Yc(a2, b2, c2, d2) {
      id = null;
      a2 = xb(d2);
      a2 = Wc(a2);
      if (null !== a2) if (b2 = Vb(a2), null === b2) a2 = null;
      else if (c2 = b2.tag, 13 === c2) {
        a2 = Wb(b2);
        if (null !== a2) return a2;
        a2 = null;
      } else if (3 === c2) {
        if (b2.stateNode.current.memoizedState.isDehydrated) return 3 === b2.tag ? b2.stateNode.containerInfo : null;
        a2 = null;
      } else b2 !== a2 && (a2 = null);
      id = a2;
      return null;
    }
    function jd(a2) {
      switch (a2) {
        case "cancel":
        case "click":
        case "close":
        case "contextmenu":
        case "copy":
        case "cut":
        case "auxclick":
        case "dblclick":
        case "dragend":
        case "dragstart":
        case "drop":
        case "focusin":
        case "focusout":
        case "input":
        case "invalid":
        case "keydown":
        case "keypress":
        case "keyup":
        case "mousedown":
        case "mouseup":
        case "paste":
        case "pause":
        case "play":
        case "pointercancel":
        case "pointerdown":
        case "pointerup":
        case "ratechange":
        case "reset":
        case "resize":
        case "seeked":
        case "submit":
        case "touchcancel":
        case "touchend":
        case "touchstart":
        case "volumechange":
        case "change":
        case "selectionchange":
        case "textInput":
        case "compositionstart":
        case "compositionend":
        case "compositionupdate":
        case "beforeblur":
        case "afterblur":
        case "beforeinput":
        case "blur":
        case "fullscreenchange":
        case "focus":
        case "hashchange":
        case "popstate":
        case "select":
        case "selectstart":
          return 1;
        case "drag":
        case "dragenter":
        case "dragexit":
        case "dragleave":
        case "dragover":
        case "mousemove":
        case "mouseout":
        case "mouseover":
        case "pointermove":
        case "pointerout":
        case "pointerover":
        case "scroll":
        case "toggle":
        case "touchmove":
        case "wheel":
        case "mouseenter":
        case "mouseleave":
        case "pointerenter":
        case "pointerleave":
          return 4;
        case "message":
          switch (ec()) {
            case fc:
              return 1;
            case gc:
              return 4;
            case hc:
            case ic:
              return 16;
            case jc:
              return 536870912;
            default:
              return 16;
          }
        default:
          return 16;
      }
    }
    var kd = null, ld = null, md = null;
    function nd() {
      if (md) return md;
      var a2, b2 = ld, c2 = b2.length, d2, e2 = "value" in kd ? kd.value : kd.textContent, f2 = e2.length;
      for (a2 = 0; a2 < c2 && b2[a2] === e2[a2]; a2++) ;
      var g2 = c2 - a2;
      for (d2 = 1; d2 <= g2 && b2[c2 - d2] === e2[f2 - d2]; d2++) ;
      return md = e2.slice(a2, 1 < d2 ? 1 - d2 : void 0);
    }
    function od(a2) {
      var b2 = a2.keyCode;
      "charCode" in a2 ? (a2 = a2.charCode, 0 === a2 && 13 === b2 && (a2 = 13)) : a2 = b2;
      10 === a2 && (a2 = 13);
      return 32 <= a2 || 13 === a2 ? a2 : 0;
    }
    function pd() {
      return true;
    }
    function qd() {
      return false;
    }
    function rd(a2) {
      function b2(b3, d2, e2, f2, g2) {
        this._reactName = b3;
        this._targetInst = e2;
        this.type = d2;
        this.nativeEvent = f2;
        this.target = g2;
        this.currentTarget = null;
        for (var c2 in a2) a2.hasOwnProperty(c2) && (b3 = a2[c2], this[c2] = b3 ? b3(f2) : f2[c2]);
        this.isDefaultPrevented = (null != f2.defaultPrevented ? f2.defaultPrevented : false === f2.returnValue) ? pd : qd;
        this.isPropagationStopped = qd;
        return this;
      }
      A2(b2.prototype, { preventDefault: function() {
        this.defaultPrevented = true;
        var a3 = this.nativeEvent;
        a3 && (a3.preventDefault ? a3.preventDefault() : "unknown" !== typeof a3.returnValue && (a3.returnValue = false), this.isDefaultPrevented = pd);
      }, stopPropagation: function() {
        var a3 = this.nativeEvent;
        a3 && (a3.stopPropagation ? a3.stopPropagation() : "unknown" !== typeof a3.cancelBubble && (a3.cancelBubble = true), this.isPropagationStopped = pd);
      }, persist: function() {
      }, isPersistent: pd });
      return b2;
    }
    var sd = { eventPhase: 0, bubbles: 0, cancelable: 0, timeStamp: function(a2) {
      return a2.timeStamp || Date.now();
    }, defaultPrevented: 0, isTrusted: 0 }, td = rd(sd), ud = A2({}, sd, { view: 0, detail: 0 }), vd = rd(ud), wd, xd, yd, Ad = A2({}, ud, { screenX: 0, screenY: 0, clientX: 0, clientY: 0, pageX: 0, pageY: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, getModifierState: zd, button: 0, buttons: 0, relatedTarget: function(a2) {
      return void 0 === a2.relatedTarget ? a2.fromElement === a2.srcElement ? a2.toElement : a2.fromElement : a2.relatedTarget;
    }, movementX: function(a2) {
      if ("movementX" in a2) return a2.movementX;
      a2 !== yd && (yd && "mousemove" === a2.type ? (wd = a2.screenX - yd.screenX, xd = a2.screenY - yd.screenY) : xd = wd = 0, yd = a2);
      return wd;
    }, movementY: function(a2) {
      return "movementY" in a2 ? a2.movementY : xd;
    } }), Bd = rd(Ad), Cd = A2({}, Ad, { dataTransfer: 0 }), Dd = rd(Cd), Ed = A2({}, ud, { relatedTarget: 0 }), Fd = rd(Ed), Gd = A2({}, sd, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }), Hd = rd(Gd), Id = A2({}, sd, { clipboardData: function(a2) {
      return "clipboardData" in a2 ? a2.clipboardData : window.clipboardData;
    } }), Jd = rd(Id), Kd = A2({}, sd, { data: 0 }), Ld = rd(Kd), Md = {
      Esc: "Escape",
      Spacebar: " ",
      Left: "ArrowLeft",
      Up: "ArrowUp",
      Right: "ArrowRight",
      Down: "ArrowDown",
      Del: "Delete",
      Win: "OS",
      Menu: "ContextMenu",
      Apps: "ContextMenu",
      Scroll: "ScrollLock",
      MozPrintableKey: "Unidentified"
    }, Nd = {
      8: "Backspace",
      9: "Tab",
      12: "Clear",
      13: "Enter",
      16: "Shift",
      17: "Control",
      18: "Alt",
      19: "Pause",
      20: "CapsLock",
      27: "Escape",
      32: " ",
      33: "PageUp",
      34: "PageDown",
      35: "End",
      36: "Home",
      37: "ArrowLeft",
      38: "ArrowUp",
      39: "ArrowRight",
      40: "ArrowDown",
      45: "Insert",
      46: "Delete",
      112: "F1",
      113: "F2",
      114: "F3",
      115: "F4",
      116: "F5",
      117: "F6",
      118: "F7",
      119: "F8",
      120: "F9",
      121: "F10",
      122: "F11",
      123: "F12",
      144: "NumLock",
      145: "ScrollLock",
      224: "Meta"
    }, Od = { Alt: "altKey", Control: "ctrlKey", Meta: "metaKey", Shift: "shiftKey" };
    function Pd(a2) {
      var b2 = this.nativeEvent;
      return b2.getModifierState ? b2.getModifierState(a2) : (a2 = Od[a2]) ? !!b2[a2] : false;
    }
    function zd() {
      return Pd;
    }
    var Qd = A2({}, ud, { key: function(a2) {
      if (a2.key) {
        var b2 = Md[a2.key] || a2.key;
        if ("Unidentified" !== b2) return b2;
      }
      return "keypress" === a2.type ? (a2 = od(a2), 13 === a2 ? "Enter" : String.fromCharCode(a2)) : "keydown" === a2.type || "keyup" === a2.type ? Nd[a2.keyCode] || "Unidentified" : "";
    }, code: 0, location: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, repeat: 0, locale: 0, getModifierState: zd, charCode: function(a2) {
      return "keypress" === a2.type ? od(a2) : 0;
    }, keyCode: function(a2) {
      return "keydown" === a2.type || "keyup" === a2.type ? a2.keyCode : 0;
    }, which: function(a2) {
      return "keypress" === a2.type ? od(a2) : "keydown" === a2.type || "keyup" === a2.type ? a2.keyCode : 0;
    } }), Rd = rd(Qd), Sd = A2({}, Ad, { pointerId: 0, width: 0, height: 0, pressure: 0, tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0, pointerType: 0, isPrimary: 0 }), Td = rd(Sd), Ud = A2({}, ud, { touches: 0, targetTouches: 0, changedTouches: 0, altKey: 0, metaKey: 0, ctrlKey: 0, shiftKey: 0, getModifierState: zd }), Vd = rd(Ud), Wd = A2({}, sd, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }), Xd = rd(Wd), Yd = A2({}, Ad, {
      deltaX: function(a2) {
        return "deltaX" in a2 ? a2.deltaX : "wheelDeltaX" in a2 ? -a2.wheelDeltaX : 0;
      },
      deltaY: function(a2) {
        return "deltaY" in a2 ? a2.deltaY : "wheelDeltaY" in a2 ? -a2.wheelDeltaY : "wheelDelta" in a2 ? -a2.wheelDelta : 0;
      },
      deltaZ: 0,
      deltaMode: 0
    }), Zd = rd(Yd), $d = [9, 13, 27, 32], ae2 = ia && "CompositionEvent" in window, be2 = null;
    ia && "documentMode" in document && (be2 = document.documentMode);
    var ce2 = ia && "TextEvent" in window && !be2, de2 = ia && (!ae2 || be2 && 8 < be2 && 11 >= be2), ee2 = String.fromCharCode(32), fe2 = false;
    function ge2(a2, b2) {
      switch (a2) {
        case "keyup":
          return -1 !== $d.indexOf(b2.keyCode);
        case "keydown":
          return 229 !== b2.keyCode;
        case "keypress":
        case "mousedown":
        case "focusout":
          return true;
        default:
          return false;
      }
    }
    function he2(a2) {
      a2 = a2.detail;
      return "object" === typeof a2 && "data" in a2 ? a2.data : null;
    }
    var ie = false;
    function je2(a2, b2) {
      switch (a2) {
        case "compositionend":
          return he2(b2);
        case "keypress":
          if (32 !== b2.which) return null;
          fe2 = true;
          return ee2;
        case "textInput":
          return a2 = b2.data, a2 === ee2 && fe2 ? null : a2;
        default:
          return null;
      }
    }
    function ke2(a2, b2) {
      if (ie) return "compositionend" === a2 || !ae2 && ge2(a2, b2) ? (a2 = nd(), md = ld = kd = null, ie = false, a2) : null;
      switch (a2) {
        case "paste":
          return null;
        case "keypress":
          if (!(b2.ctrlKey || b2.altKey || b2.metaKey) || b2.ctrlKey && b2.altKey) {
            if (b2.char && 1 < b2.char.length) return b2.char;
            if (b2.which) return String.fromCharCode(b2.which);
          }
          return null;
        case "compositionend":
          return de2 && "ko" !== b2.locale ? null : b2.data;
        default:
          return null;
      }
    }
    var le2 = { color: true, date: true, datetime: true, "datetime-local": true, email: true, month: true, number: true, password: true, range: true, search: true, tel: true, text: true, time: true, url: true, week: true };
    function me2(a2) {
      var b2 = a2 && a2.nodeName && a2.nodeName.toLowerCase();
      return "input" === b2 ? !!le2[a2.type] : "textarea" === b2 ? true : false;
    }
    function ne2(a2, b2, c2, d2) {
      Eb(d2);
      b2 = oe2(b2, "onChange");
      0 < b2.length && (c2 = new td("onChange", "change", null, c2, d2), a2.push({ event: c2, listeners: b2 }));
    }
    var pe2 = null, qe2 = null;
    function re2(a2) {
      se2(a2, 0);
    }
    function te2(a2) {
      var b2 = ue2(a2);
      if (Wa(b2)) return a2;
    }
    function ve2(a2, b2) {
      if ("change" === a2) return b2;
    }
    var we2 = false;
    if (ia) {
      var xe2;
      if (ia) {
        var ye2 = "oninput" in document;
        if (!ye2) {
          var ze2 = document.createElement("div");
          ze2.setAttribute("oninput", "return;");
          ye2 = "function" === typeof ze2.oninput;
        }
        xe2 = ye2;
      } else xe2 = false;
      we2 = xe2 && (!document.documentMode || 9 < document.documentMode);
    }
    function Ae2() {
      pe2 && (pe2.detachEvent("onpropertychange", Be2), qe2 = pe2 = null);
    }
    function Be2(a2) {
      if ("value" === a2.propertyName && te2(qe2)) {
        var b2 = [];
        ne2(b2, qe2, a2, xb(a2));
        Jb(re2, b2);
      }
    }
    function Ce2(a2, b2, c2) {
      "focusin" === a2 ? (Ae2(), pe2 = b2, qe2 = c2, pe2.attachEvent("onpropertychange", Be2)) : "focusout" === a2 && Ae2();
    }
    function De2(a2) {
      if ("selectionchange" === a2 || "keyup" === a2 || "keydown" === a2) return te2(qe2);
    }
    function Ee2(a2, b2) {
      if ("click" === a2) return te2(b2);
    }
    function Fe2(a2, b2) {
      if ("input" === a2 || "change" === a2) return te2(b2);
    }
    function Ge2(a2, b2) {
      return a2 === b2 && (0 !== a2 || 1 / a2 === 1 / b2) || a2 !== a2 && b2 !== b2;
    }
    var He2 = "function" === typeof Object.is ? Object.is : Ge2;
    function Ie2(a2, b2) {
      if (He2(a2, b2)) return true;
      if ("object" !== typeof a2 || null === a2 || "object" !== typeof b2 || null === b2) return false;
      var c2 = Object.keys(a2), d2 = Object.keys(b2);
      if (c2.length !== d2.length) return false;
      for (d2 = 0; d2 < c2.length; d2++) {
        var e2 = c2[d2];
        if (!ja.call(b2, e2) || !He2(a2[e2], b2[e2])) return false;
      }
      return true;
    }
    function Je2(a2) {
      for (; a2 && a2.firstChild; ) a2 = a2.firstChild;
      return a2;
    }
    function Ke2(a2, b2) {
      var c2 = Je2(a2);
      a2 = 0;
      for (var d2; c2; ) {
        if (3 === c2.nodeType) {
          d2 = a2 + c2.textContent.length;
          if (a2 <= b2 && d2 >= b2) return { node: c2, offset: b2 - a2 };
          a2 = d2;
        }
        a: {
          for (; c2; ) {
            if (c2.nextSibling) {
              c2 = c2.nextSibling;
              break a;
            }
            c2 = c2.parentNode;
          }
          c2 = void 0;
        }
        c2 = Je2(c2);
      }
    }
    function Le2(a2, b2) {
      return a2 && b2 ? a2 === b2 ? true : a2 && 3 === a2.nodeType ? false : b2 && 3 === b2.nodeType ? Le2(a2, b2.parentNode) : "contains" in a2 ? a2.contains(b2) : a2.compareDocumentPosition ? !!(a2.compareDocumentPosition(b2) & 16) : false : false;
    }
    function Me2() {
      for (var a2 = window, b2 = Xa(); b2 instanceof a2.HTMLIFrameElement; ) {
        try {
          var c2 = "string" === typeof b2.contentWindow.location.href;
        } catch (d2) {
          c2 = false;
        }
        if (c2) a2 = b2.contentWindow;
        else break;
        b2 = Xa(a2.document);
      }
      return b2;
    }
    function Ne2(a2) {
      var b2 = a2 && a2.nodeName && a2.nodeName.toLowerCase();
      return b2 && ("input" === b2 && ("text" === a2.type || "search" === a2.type || "tel" === a2.type || "url" === a2.type || "password" === a2.type) || "textarea" === b2 || "true" === a2.contentEditable);
    }
    function Oe2(a2) {
      var b2 = Me2(), c2 = a2.focusedElem, d2 = a2.selectionRange;
      if (b2 !== c2 && c2 && c2.ownerDocument && Le2(c2.ownerDocument.documentElement, c2)) {
        if (null !== d2 && Ne2(c2)) {
          if (b2 = d2.start, a2 = d2.end, void 0 === a2 && (a2 = b2), "selectionStart" in c2) c2.selectionStart = b2, c2.selectionEnd = Math.min(a2, c2.value.length);
          else if (a2 = (b2 = c2.ownerDocument || document) && b2.defaultView || window, a2.getSelection) {
            a2 = a2.getSelection();
            var e2 = c2.textContent.length, f2 = Math.min(d2.start, e2);
            d2 = void 0 === d2.end ? f2 : Math.min(d2.end, e2);
            !a2.extend && f2 > d2 && (e2 = d2, d2 = f2, f2 = e2);
            e2 = Ke2(c2, f2);
            var g2 = Ke2(
              c2,
              d2
            );
            e2 && g2 && (1 !== a2.rangeCount || a2.anchorNode !== e2.node || a2.anchorOffset !== e2.offset || a2.focusNode !== g2.node || a2.focusOffset !== g2.offset) && (b2 = b2.createRange(), b2.setStart(e2.node, e2.offset), a2.removeAllRanges(), f2 > d2 ? (a2.addRange(b2), a2.extend(g2.node, g2.offset)) : (b2.setEnd(g2.node, g2.offset), a2.addRange(b2)));
          }
        }
        b2 = [];
        for (a2 = c2; a2 = a2.parentNode; ) 1 === a2.nodeType && b2.push({ element: a2, left: a2.scrollLeft, top: a2.scrollTop });
        "function" === typeof c2.focus && c2.focus();
        for (c2 = 0; c2 < b2.length; c2++) a2 = b2[c2], a2.element.scrollLeft = a2.left, a2.element.scrollTop = a2.top;
      }
    }
    var Pe2 = ia && "documentMode" in document && 11 >= document.documentMode, Qe2 = null, Re2 = null, Se2 = null, Te2 = false;
    function Ue2(a2, b2, c2) {
      var d2 = c2.window === c2 ? c2.document : 9 === c2.nodeType ? c2 : c2.ownerDocument;
      Te2 || null == Qe2 || Qe2 !== Xa(d2) || (d2 = Qe2, "selectionStart" in d2 && Ne2(d2) ? d2 = { start: d2.selectionStart, end: d2.selectionEnd } : (d2 = (d2.ownerDocument && d2.ownerDocument.defaultView || window).getSelection(), d2 = { anchorNode: d2.anchorNode, anchorOffset: d2.anchorOffset, focusNode: d2.focusNode, focusOffset: d2.focusOffset }), Se2 && Ie2(Se2, d2) || (Se2 = d2, d2 = oe2(Re2, "onSelect"), 0 < d2.length && (b2 = new td("onSelect", "select", null, b2, c2), a2.push({ event: b2, listeners: d2 }), b2.target = Qe2)));
    }
    function Ve2(a2, b2) {
      var c2 = {};
      c2[a2.toLowerCase()] = b2.toLowerCase();
      c2["Webkit" + a2] = "webkit" + b2;
      c2["Moz" + a2] = "moz" + b2;
      return c2;
    }
    var We2 = { animationend: Ve2("Animation", "AnimationEnd"), animationiteration: Ve2("Animation", "AnimationIteration"), animationstart: Ve2("Animation", "AnimationStart"), transitionend: Ve2("Transition", "TransitionEnd") }, Xe2 = {}, Ye2 = {};
    ia && (Ye2 = document.createElement("div").style, "AnimationEvent" in window || (delete We2.animationend.animation, delete We2.animationiteration.animation, delete We2.animationstart.animation), "TransitionEvent" in window || delete We2.transitionend.transition);
    function Ze2(a2) {
      if (Xe2[a2]) return Xe2[a2];
      if (!We2[a2]) return a2;
      var b2 = We2[a2], c2;
      for (c2 in b2) if (b2.hasOwnProperty(c2) && c2 in Ye2) return Xe2[a2] = b2[c2];
      return a2;
    }
    var $e2 = Ze2("animationend"), af = Ze2("animationiteration"), bf = Ze2("animationstart"), cf = Ze2("transitionend"), df = /* @__PURE__ */ new Map(), ef = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
    function ff(a2, b2) {
      df.set(a2, b2);
      fa(b2, [a2]);
    }
    for (var gf = 0; gf < ef.length; gf++) {
      var hf = ef[gf], jf = hf.toLowerCase(), kf = hf[0].toUpperCase() + hf.slice(1);
      ff(jf, "on" + kf);
    }
    ff($e2, "onAnimationEnd");
    ff(af, "onAnimationIteration");
    ff(bf, "onAnimationStart");
    ff("dblclick", "onDoubleClick");
    ff("focusin", "onFocus");
    ff("focusout", "onBlur");
    ff(cf, "onTransitionEnd");
    ha("onMouseEnter", ["mouseout", "mouseover"]);
    ha("onMouseLeave", ["mouseout", "mouseover"]);
    ha("onPointerEnter", ["pointerout", "pointerover"]);
    ha("onPointerLeave", ["pointerout", "pointerover"]);
    fa("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
    fa("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
    fa("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]);
    fa("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
    fa("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
    fa("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
    var lf = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), mf = new Set("cancel close invalid load scroll toggle".split(" ").concat(lf));
    function nf(a2, b2, c2) {
      var d2 = a2.type || "unknown-event";
      a2.currentTarget = c2;
      Ub(d2, b2, void 0, a2);
      a2.currentTarget = null;
    }
    function se2(a2, b2) {
      b2 = 0 !== (b2 & 4);
      for (var c2 = 0; c2 < a2.length; c2++) {
        var d2 = a2[c2], e2 = d2.event;
        d2 = d2.listeners;
        a: {
          var f2 = void 0;
          if (b2) for (var g2 = d2.length - 1; 0 <= g2; g2--) {
            var h2 = d2[g2], k2 = h2.instance, l2 = h2.currentTarget;
            h2 = h2.listener;
            if (k2 !== f2 && e2.isPropagationStopped()) break a;
            nf(e2, h2, l2);
            f2 = k2;
          }
          else for (g2 = 0; g2 < d2.length; g2++) {
            h2 = d2[g2];
            k2 = h2.instance;
            l2 = h2.currentTarget;
            h2 = h2.listener;
            if (k2 !== f2 && e2.isPropagationStopped()) break a;
            nf(e2, h2, l2);
            f2 = k2;
          }
        }
      }
      if (Qb) throw a2 = Rb, Qb = false, Rb = null, a2;
    }
    function D2(a2, b2) {
      var c2 = b2[of];
      void 0 === c2 && (c2 = b2[of] = /* @__PURE__ */ new Set());
      var d2 = a2 + "__bubble";
      c2.has(d2) || (pf(b2, a2, 2, false), c2.add(d2));
    }
    function qf(a2, b2, c2) {
      var d2 = 0;
      b2 && (d2 |= 4);
      pf(c2, a2, d2, b2);
    }
    var rf = "_reactListening" + Math.random().toString(36).slice(2);
    function sf(a2) {
      if (!a2[rf]) {
        a2[rf] = true;
        da.forEach(function(b3) {
          "selectionchange" !== b3 && (mf.has(b3) || qf(b3, false, a2), qf(b3, true, a2));
        });
        var b2 = 9 === a2.nodeType ? a2 : a2.ownerDocument;
        null === b2 || b2[rf] || (b2[rf] = true, qf("selectionchange", false, b2));
      }
    }
    function pf(a2, b2, c2, d2) {
      switch (jd(b2)) {
        case 1:
          var e2 = ed;
          break;
        case 4:
          e2 = gd;
          break;
        default:
          e2 = fd;
      }
      c2 = e2.bind(null, b2, c2, a2);
      e2 = void 0;
      !Lb || "touchstart" !== b2 && "touchmove" !== b2 && "wheel" !== b2 || (e2 = true);
      d2 ? void 0 !== e2 ? a2.addEventListener(b2, c2, { capture: true, passive: e2 }) : a2.addEventListener(b2, c2, true) : void 0 !== e2 ? a2.addEventListener(b2, c2, { passive: e2 }) : a2.addEventListener(b2, c2, false);
    }
    function hd(a2, b2, c2, d2, e2) {
      var f2 = d2;
      if (0 === (b2 & 1) && 0 === (b2 & 2) && null !== d2) a: for (; ; ) {
        if (null === d2) return;
        var g2 = d2.tag;
        if (3 === g2 || 4 === g2) {
          var h2 = d2.stateNode.containerInfo;
          if (h2 === e2 || 8 === h2.nodeType && h2.parentNode === e2) break;
          if (4 === g2) for (g2 = d2.return; null !== g2; ) {
            var k2 = g2.tag;
            if (3 === k2 || 4 === k2) {
              if (k2 = g2.stateNode.containerInfo, k2 === e2 || 8 === k2.nodeType && k2.parentNode === e2) return;
            }
            g2 = g2.return;
          }
          for (; null !== h2; ) {
            g2 = Wc(h2);
            if (null === g2) return;
            k2 = g2.tag;
            if (5 === k2 || 6 === k2) {
              d2 = f2 = g2;
              continue a;
            }
            h2 = h2.parentNode;
          }
        }
        d2 = d2.return;
      }
      Jb(function() {
        var d3 = f2, e3 = xb(c2), g3 = [];
        a: {
          var h3 = df.get(a2);
          if (void 0 !== h3) {
            var k3 = td, n2 = a2;
            switch (a2) {
              case "keypress":
                if (0 === od(c2)) break a;
              case "keydown":
              case "keyup":
                k3 = Rd;
                break;
              case "focusin":
                n2 = "focus";
                k3 = Fd;
                break;
              case "focusout":
                n2 = "blur";
                k3 = Fd;
                break;
              case "beforeblur":
              case "afterblur":
                k3 = Fd;
                break;
              case "click":
                if (2 === c2.button) break a;
              case "auxclick":
              case "dblclick":
              case "mousedown":
              case "mousemove":
              case "mouseup":
              case "mouseout":
              case "mouseover":
              case "contextmenu":
                k3 = Bd;
                break;
              case "drag":
              case "dragend":
              case "dragenter":
              case "dragexit":
              case "dragleave":
              case "dragover":
              case "dragstart":
              case "drop":
                k3 = Dd;
                break;
              case "touchcancel":
              case "touchend":
              case "touchmove":
              case "touchstart":
                k3 = Vd;
                break;
              case $e2:
              case af:
              case bf:
                k3 = Hd;
                break;
              case cf:
                k3 = Xd;
                break;
              case "scroll":
                k3 = vd;
                break;
              case "wheel":
                k3 = Zd;
                break;
              case "copy":
              case "cut":
              case "paste":
                k3 = Jd;
                break;
              case "gotpointercapture":
              case "lostpointercapture":
              case "pointercancel":
              case "pointerdown":
              case "pointermove":
              case "pointerout":
              case "pointerover":
              case "pointerup":
                k3 = Td;
            }
            var t2 = 0 !== (b2 & 4), J2 = !t2 && "scroll" === a2, x2 = t2 ? null !== h3 ? h3 + "Capture" : null : h3;
            t2 = [];
            for (var w2 = d3, u2; null !== w2; ) {
              u2 = w2;
              var F2 = u2.stateNode;
              5 === u2.tag && null !== F2 && (u2 = F2, null !== x2 && (F2 = Kb(w2, x2), null != F2 && t2.push(tf(w2, F2, u2))));
              if (J2) break;
              w2 = w2.return;
            }
            0 < t2.length && (h3 = new k3(h3, n2, null, c2, e3), g3.push({ event: h3, listeners: t2 }));
          }
        }
        if (0 === (b2 & 7)) {
          a: {
            h3 = "mouseover" === a2 || "pointerover" === a2;
            k3 = "mouseout" === a2 || "pointerout" === a2;
            if (h3 && c2 !== wb && (n2 = c2.relatedTarget || c2.fromElement) && (Wc(n2) || n2[uf])) break a;
            if (k3 || h3) {
              h3 = e3.window === e3 ? e3 : (h3 = e3.ownerDocument) ? h3.defaultView || h3.parentWindow : window;
              if (k3) {
                if (n2 = c2.relatedTarget || c2.toElement, k3 = d3, n2 = n2 ? Wc(n2) : null, null !== n2 && (J2 = Vb(n2), n2 !== J2 || 5 !== n2.tag && 6 !== n2.tag)) n2 = null;
              } else k3 = null, n2 = d3;
              if (k3 !== n2) {
                t2 = Bd;
                F2 = "onMouseLeave";
                x2 = "onMouseEnter";
                w2 = "mouse";
                if ("pointerout" === a2 || "pointerover" === a2) t2 = Td, F2 = "onPointerLeave", x2 = "onPointerEnter", w2 = "pointer";
                J2 = null == k3 ? h3 : ue2(k3);
                u2 = null == n2 ? h3 : ue2(n2);
                h3 = new t2(F2, w2 + "leave", k3, c2, e3);
                h3.target = J2;
                h3.relatedTarget = u2;
                F2 = null;
                Wc(e3) === d3 && (t2 = new t2(x2, w2 + "enter", n2, c2, e3), t2.target = u2, t2.relatedTarget = J2, F2 = t2);
                J2 = F2;
                if (k3 && n2) b: {
                  t2 = k3;
                  x2 = n2;
                  w2 = 0;
                  for (u2 = t2; u2; u2 = vf(u2)) w2++;
                  u2 = 0;
                  for (F2 = x2; F2; F2 = vf(F2)) u2++;
                  for (; 0 < w2 - u2; ) t2 = vf(t2), w2--;
                  for (; 0 < u2 - w2; ) x2 = vf(x2), u2--;
                  for (; w2--; ) {
                    if (t2 === x2 || null !== x2 && t2 === x2.alternate) break b;
                    t2 = vf(t2);
                    x2 = vf(x2);
                  }
                  t2 = null;
                }
                else t2 = null;
                null !== k3 && wf(g3, h3, k3, t2, false);
                null !== n2 && null !== J2 && wf(g3, J2, n2, t2, true);
              }
            }
          }
          a: {
            h3 = d3 ? ue2(d3) : window;
            k3 = h3.nodeName && h3.nodeName.toLowerCase();
            if ("select" === k3 || "input" === k3 && "file" === h3.type) var na = ve2;
            else if (me2(h3)) if (we2) na = Fe2;
            else {
              na = De2;
              var xa = Ce2;
            }
            else (k3 = h3.nodeName) && "input" === k3.toLowerCase() && ("checkbox" === h3.type || "radio" === h3.type) && (na = Ee2);
            if (na && (na = na(a2, d3))) {
              ne2(g3, na, c2, e3);
              break a;
            }
            xa && xa(a2, h3, d3);
            "focusout" === a2 && (xa = h3._wrapperState) && xa.controlled && "number" === h3.type && cb(h3, "number", h3.value);
          }
          xa = d3 ? ue2(d3) : window;
          switch (a2) {
            case "focusin":
              if (me2(xa) || "true" === xa.contentEditable) Qe2 = xa, Re2 = d3, Se2 = null;
              break;
            case "focusout":
              Se2 = Re2 = Qe2 = null;
              break;
            case "mousedown":
              Te2 = true;
              break;
            case "contextmenu":
            case "mouseup":
            case "dragend":
              Te2 = false;
              Ue2(g3, c2, e3);
              break;
            case "selectionchange":
              if (Pe2) break;
            case "keydown":
            case "keyup":
              Ue2(g3, c2, e3);
          }
          var $a;
          if (ae2) b: {
            switch (a2) {
              case "compositionstart":
                var ba = "onCompositionStart";
                break b;
              case "compositionend":
                ba = "onCompositionEnd";
                break b;
              case "compositionupdate":
                ba = "onCompositionUpdate";
                break b;
            }
            ba = void 0;
          }
          else ie ? ge2(a2, c2) && (ba = "onCompositionEnd") : "keydown" === a2 && 229 === c2.keyCode && (ba = "onCompositionStart");
          ba && (de2 && "ko" !== c2.locale && (ie || "onCompositionStart" !== ba ? "onCompositionEnd" === ba && ie && ($a = nd()) : (kd = e3, ld = "value" in kd ? kd.value : kd.textContent, ie = true)), xa = oe2(d3, ba), 0 < xa.length && (ba = new Ld(ba, a2, null, c2, e3), g3.push({ event: ba, listeners: xa }), $a ? ba.data = $a : ($a = he2(c2), null !== $a && (ba.data = $a))));
          if ($a = ce2 ? je2(a2, c2) : ke2(a2, c2)) d3 = oe2(d3, "onBeforeInput"), 0 < d3.length && (e3 = new Ld("onBeforeInput", "beforeinput", null, c2, e3), g3.push({ event: e3, listeners: d3 }), e3.data = $a);
        }
        se2(g3, b2);
      });
    }
    function tf(a2, b2, c2) {
      return { instance: a2, listener: b2, currentTarget: c2 };
    }
    function oe2(a2, b2) {
      for (var c2 = b2 + "Capture", d2 = []; null !== a2; ) {
        var e2 = a2, f2 = e2.stateNode;
        5 === e2.tag && null !== f2 && (e2 = f2, f2 = Kb(a2, c2), null != f2 && d2.unshift(tf(a2, f2, e2)), f2 = Kb(a2, b2), null != f2 && d2.push(tf(a2, f2, e2)));
        a2 = a2.return;
      }
      return d2;
    }
    function vf(a2) {
      if (null === a2) return null;
      do
        a2 = a2.return;
      while (a2 && 5 !== a2.tag);
      return a2 ? a2 : null;
    }
    function wf(a2, b2, c2, d2, e2) {
      for (var f2 = b2._reactName, g2 = []; null !== c2 && c2 !== d2; ) {
        var h2 = c2, k2 = h2.alternate, l2 = h2.stateNode;
        if (null !== k2 && k2 === d2) break;
        5 === h2.tag && null !== l2 && (h2 = l2, e2 ? (k2 = Kb(c2, f2), null != k2 && g2.unshift(tf(c2, k2, h2))) : e2 || (k2 = Kb(c2, f2), null != k2 && g2.push(tf(c2, k2, h2))));
        c2 = c2.return;
      }
      0 !== g2.length && a2.push({ event: b2, listeners: g2 });
    }
    var xf = /\r\n?/g, yf = /\u0000|\uFFFD/g;
    function zf(a2) {
      return ("string" === typeof a2 ? a2 : "" + a2).replace(xf, "\n").replace(yf, "");
    }
    function Af(a2, b2, c2) {
      b2 = zf(b2);
      if (zf(a2) !== b2 && c2) throw Error(p2(425));
    }
    function Bf() {
    }
    var Cf = null, Df = null;
    function Ef(a2, b2) {
      return "textarea" === a2 || "noscript" === a2 || "string" === typeof b2.children || "number" === typeof b2.children || "object" === typeof b2.dangerouslySetInnerHTML && null !== b2.dangerouslySetInnerHTML && null != b2.dangerouslySetInnerHTML.__html;
    }
    var Ff = "function" === typeof setTimeout ? setTimeout : void 0, Gf = "function" === typeof clearTimeout ? clearTimeout : void 0, Hf = "function" === typeof Promise ? Promise : void 0, Jf = "function" === typeof queueMicrotask ? queueMicrotask : "undefined" !== typeof Hf ? function(a2) {
      return Hf.resolve(null).then(a2).catch(If);
    } : Ff;
    function If(a2) {
      setTimeout(function() {
        throw a2;
      });
    }
    function Kf(a2, b2) {
      var c2 = b2, d2 = 0;
      do {
        var e2 = c2.nextSibling;
        a2.removeChild(c2);
        if (e2 && 8 === e2.nodeType) if (c2 = e2.data, "/$" === c2) {
          if (0 === d2) {
            a2.removeChild(e2);
            bd(b2);
            return;
          }
          d2--;
        } else "$" !== c2 && "$?" !== c2 && "$!" !== c2 || d2++;
        c2 = e2;
      } while (c2);
      bd(b2);
    }
    function Lf(a2) {
      for (; null != a2; a2 = a2.nextSibling) {
        var b2 = a2.nodeType;
        if (1 === b2 || 3 === b2) break;
        if (8 === b2) {
          b2 = a2.data;
          if ("$" === b2 || "$!" === b2 || "$?" === b2) break;
          if ("/$" === b2) return null;
        }
      }
      return a2;
    }
    function Mf(a2) {
      a2 = a2.previousSibling;
      for (var b2 = 0; a2; ) {
        if (8 === a2.nodeType) {
          var c2 = a2.data;
          if ("$" === c2 || "$!" === c2 || "$?" === c2) {
            if (0 === b2) return a2;
            b2--;
          } else "/$" === c2 && b2++;
        }
        a2 = a2.previousSibling;
      }
      return null;
    }
    var Nf = Math.random().toString(36).slice(2), Of = "__reactFiber$" + Nf, Pf = "__reactProps$" + Nf, uf = "__reactContainer$" + Nf, of = "__reactEvents$" + Nf, Qf = "__reactListeners$" + Nf, Rf = "__reactHandles$" + Nf;
    function Wc(a2) {
      var b2 = a2[Of];
      if (b2) return b2;
      for (var c2 = a2.parentNode; c2; ) {
        if (b2 = c2[uf] || c2[Of]) {
          c2 = b2.alternate;
          if (null !== b2.child || null !== c2 && null !== c2.child) for (a2 = Mf(a2); null !== a2; ) {
            if (c2 = a2[Of]) return c2;
            a2 = Mf(a2);
          }
          return b2;
        }
        a2 = c2;
        c2 = a2.parentNode;
      }
      return null;
    }
    function Cb(a2) {
      a2 = a2[Of] || a2[uf];
      return !a2 || 5 !== a2.tag && 6 !== a2.tag && 13 !== a2.tag && 3 !== a2.tag ? null : a2;
    }
    function ue2(a2) {
      if (5 === a2.tag || 6 === a2.tag) return a2.stateNode;
      throw Error(p2(33));
    }
    function Db(a2) {
      return a2[Pf] || null;
    }
    var Sf = [], Tf = -1;
    function Uf(a2) {
      return { current: a2 };
    }
    function E2(a2) {
      0 > Tf || (a2.current = Sf[Tf], Sf[Tf] = null, Tf--);
    }
    function G2(a2, b2) {
      Tf++;
      Sf[Tf] = a2.current;
      a2.current = b2;
    }
    var Vf = {}, H2 = Uf(Vf), Wf = Uf(false), Xf = Vf;
    function Yf(a2, b2) {
      var c2 = a2.type.contextTypes;
      if (!c2) return Vf;
      var d2 = a2.stateNode;
      if (d2 && d2.__reactInternalMemoizedUnmaskedChildContext === b2) return d2.__reactInternalMemoizedMaskedChildContext;
      var e2 = {}, f2;
      for (f2 in c2) e2[f2] = b2[f2];
      d2 && (a2 = a2.stateNode, a2.__reactInternalMemoizedUnmaskedChildContext = b2, a2.__reactInternalMemoizedMaskedChildContext = e2);
      return e2;
    }
    function Zf(a2) {
      a2 = a2.childContextTypes;
      return null !== a2 && void 0 !== a2;
    }
    function $f() {
      E2(Wf);
      E2(H2);
    }
    function ag(a2, b2, c2) {
      if (H2.current !== Vf) throw Error(p2(168));
      G2(H2, b2);
      G2(Wf, c2);
    }
    function bg(a2, b2, c2) {
      var d2 = a2.stateNode;
      b2 = b2.childContextTypes;
      if ("function" !== typeof d2.getChildContext) return c2;
      d2 = d2.getChildContext();
      for (var e2 in d2) if (!(e2 in b2)) throw Error(p2(108, Ra(a2) || "Unknown", e2));
      return A2({}, c2, d2);
    }
    function cg(a2) {
      a2 = (a2 = a2.stateNode) && a2.__reactInternalMemoizedMergedChildContext || Vf;
      Xf = H2.current;
      G2(H2, a2);
      G2(Wf, Wf.current);
      return true;
    }
    function dg(a2, b2, c2) {
      var d2 = a2.stateNode;
      if (!d2) throw Error(p2(169));
      c2 ? (a2 = bg(a2, b2, Xf), d2.__reactInternalMemoizedMergedChildContext = a2, E2(Wf), E2(H2), G2(H2, a2)) : E2(Wf);
      G2(Wf, c2);
    }
    var eg = null, fg = false, gg = false;
    function hg(a2) {
      null === eg ? eg = [a2] : eg.push(a2);
    }
    function ig(a2) {
      fg = true;
      hg(a2);
    }
    function jg() {
      if (!gg && null !== eg) {
        gg = true;
        var a2 = 0, b2 = C2;
        try {
          var c2 = eg;
          for (C2 = 1; a2 < c2.length; a2++) {
            var d2 = c2[a2];
            do
              d2 = d2(true);
            while (null !== d2);
          }
          eg = null;
          fg = false;
        } catch (e2) {
          throw null !== eg && (eg = eg.slice(a2 + 1)), ac(fc, jg), e2;
        } finally {
          C2 = b2, gg = false;
        }
      }
      return null;
    }
    var kg = [], lg = 0, mg = null, ng = 0, og = [], pg = 0, qg = null, rg = 1, sg = "";
    function tg(a2, b2) {
      kg[lg++] = ng;
      kg[lg++] = mg;
      mg = a2;
      ng = b2;
    }
    function ug(a2, b2, c2) {
      og[pg++] = rg;
      og[pg++] = sg;
      og[pg++] = qg;
      qg = a2;
      var d2 = rg;
      a2 = sg;
      var e2 = 32 - oc(d2) - 1;
      d2 &= ~(1 << e2);
      c2 += 1;
      var f2 = 32 - oc(b2) + e2;
      if (30 < f2) {
        var g2 = e2 - e2 % 5;
        f2 = (d2 & (1 << g2) - 1).toString(32);
        d2 >>= g2;
        e2 -= g2;
        rg = 1 << 32 - oc(b2) + e2 | c2 << e2 | d2;
        sg = f2 + a2;
      } else rg = 1 << f2 | c2 << e2 | d2, sg = a2;
    }
    function vg(a2) {
      null !== a2.return && (tg(a2, 1), ug(a2, 1, 0));
    }
    function wg(a2) {
      for (; a2 === mg; ) mg = kg[--lg], kg[lg] = null, ng = kg[--lg], kg[lg] = null;
      for (; a2 === qg; ) qg = og[--pg], og[pg] = null, sg = og[--pg], og[pg] = null, rg = og[--pg], og[pg] = null;
    }
    var xg = null, yg = null, I2 = false, zg = null;
    function Ag(a2, b2) {
      var c2 = Bg(5, null, null, 0);
      c2.elementType = "DELETED";
      c2.stateNode = b2;
      c2.return = a2;
      b2 = a2.deletions;
      null === b2 ? (a2.deletions = [c2], a2.flags |= 16) : b2.push(c2);
    }
    function Cg(a2, b2) {
      switch (a2.tag) {
        case 5:
          var c2 = a2.type;
          b2 = 1 !== b2.nodeType || c2.toLowerCase() !== b2.nodeName.toLowerCase() ? null : b2;
          return null !== b2 ? (a2.stateNode = b2, xg = a2, yg = Lf(b2.firstChild), true) : false;
        case 6:
          return b2 = "" === a2.pendingProps || 3 !== b2.nodeType ? null : b2, null !== b2 ? (a2.stateNode = b2, xg = a2, yg = null, true) : false;
        case 13:
          return b2 = 8 !== b2.nodeType ? null : b2, null !== b2 ? (c2 = null !== qg ? { id: rg, overflow: sg } : null, a2.memoizedState = { dehydrated: b2, treeContext: c2, retryLane: 1073741824 }, c2 = Bg(18, null, null, 0), c2.stateNode = b2, c2.return = a2, a2.child = c2, xg = a2, yg = null, true) : false;
        default:
          return false;
      }
    }
    function Dg(a2) {
      return 0 !== (a2.mode & 1) && 0 === (a2.flags & 128);
    }
    function Eg(a2) {
      if (I2) {
        var b2 = yg;
        if (b2) {
          var c2 = b2;
          if (!Cg(a2, b2)) {
            if (Dg(a2)) throw Error(p2(418));
            b2 = Lf(c2.nextSibling);
            var d2 = xg;
            b2 && Cg(a2, b2) ? Ag(d2, c2) : (a2.flags = a2.flags & -4097 | 2, I2 = false, xg = a2);
          }
        } else {
          if (Dg(a2)) throw Error(p2(418));
          a2.flags = a2.flags & -4097 | 2;
          I2 = false;
          xg = a2;
        }
      }
    }
    function Fg(a2) {
      for (a2 = a2.return; null !== a2 && 5 !== a2.tag && 3 !== a2.tag && 13 !== a2.tag; ) a2 = a2.return;
      xg = a2;
    }
    function Gg(a2) {
      if (a2 !== xg) return false;
      if (!I2) return Fg(a2), I2 = true, false;
      var b2;
      (b2 = 3 !== a2.tag) && !(b2 = 5 !== a2.tag) && (b2 = a2.type, b2 = "head" !== b2 && "body" !== b2 && !Ef(a2.type, a2.memoizedProps));
      if (b2 && (b2 = yg)) {
        if (Dg(a2)) throw Hg(), Error(p2(418));
        for (; b2; ) Ag(a2, b2), b2 = Lf(b2.nextSibling);
      }
      Fg(a2);
      if (13 === a2.tag) {
        a2 = a2.memoizedState;
        a2 = null !== a2 ? a2.dehydrated : null;
        if (!a2) throw Error(p2(317));
        a: {
          a2 = a2.nextSibling;
          for (b2 = 0; a2; ) {
            if (8 === a2.nodeType) {
              var c2 = a2.data;
              if ("/$" === c2) {
                if (0 === b2) {
                  yg = Lf(a2.nextSibling);
                  break a;
                }
                b2--;
              } else "$" !== c2 && "$!" !== c2 && "$?" !== c2 || b2++;
            }
            a2 = a2.nextSibling;
          }
          yg = null;
        }
      } else yg = xg ? Lf(a2.stateNode.nextSibling) : null;
      return true;
    }
    function Hg() {
      for (var a2 = yg; a2; ) a2 = Lf(a2.nextSibling);
    }
    function Ig() {
      yg = xg = null;
      I2 = false;
    }
    function Jg(a2) {
      null === zg ? zg = [a2] : zg.push(a2);
    }
    var Kg = ua.ReactCurrentBatchConfig;
    function Lg(a2, b2, c2) {
      a2 = c2.ref;
      if (null !== a2 && "function" !== typeof a2 && "object" !== typeof a2) {
        if (c2._owner) {
          c2 = c2._owner;
          if (c2) {
            if (1 !== c2.tag) throw Error(p2(309));
            var d2 = c2.stateNode;
          }
          if (!d2) throw Error(p2(147, a2));
          var e2 = d2, f2 = "" + a2;
          if (null !== b2 && null !== b2.ref && "function" === typeof b2.ref && b2.ref._stringRef === f2) return b2.ref;
          b2 = function(a3) {
            var b3 = e2.refs;
            null === a3 ? delete b3[f2] : b3[f2] = a3;
          };
          b2._stringRef = f2;
          return b2;
        }
        if ("string" !== typeof a2) throw Error(p2(284));
        if (!c2._owner) throw Error(p2(290, a2));
      }
      return a2;
    }
    function Mg(a2, b2) {
      a2 = Object.prototype.toString.call(b2);
      throw Error(p2(31, "[object Object]" === a2 ? "object with keys {" + Object.keys(b2).join(", ") + "}" : a2));
    }
    function Ng(a2) {
      var b2 = a2._init;
      return b2(a2._payload);
    }
    function Og(a2) {
      function b2(b3, c3) {
        if (a2) {
          var d3 = b3.deletions;
          null === d3 ? (b3.deletions = [c3], b3.flags |= 16) : d3.push(c3);
        }
      }
      function c2(c3, d3) {
        if (!a2) return null;
        for (; null !== d3; ) b2(c3, d3), d3 = d3.sibling;
        return null;
      }
      function d2(a3, b3) {
        for (a3 = /* @__PURE__ */ new Map(); null !== b3; ) null !== b3.key ? a3.set(b3.key, b3) : a3.set(b3.index, b3), b3 = b3.sibling;
        return a3;
      }
      function e2(a3, b3) {
        a3 = Pg(a3, b3);
        a3.index = 0;
        a3.sibling = null;
        return a3;
      }
      function f2(b3, c3, d3) {
        b3.index = d3;
        if (!a2) return b3.flags |= 1048576, c3;
        d3 = b3.alternate;
        if (null !== d3) return d3 = d3.index, d3 < c3 ? (b3.flags |= 2, c3) : d3;
        b3.flags |= 2;
        return c3;
      }
      function g2(b3) {
        a2 && null === b3.alternate && (b3.flags |= 2);
        return b3;
      }
      function h2(a3, b3, c3, d3) {
        if (null === b3 || 6 !== b3.tag) return b3 = Qg(c3, a3.mode, d3), b3.return = a3, b3;
        b3 = e2(b3, c3);
        b3.return = a3;
        return b3;
      }
      function k2(a3, b3, c3, d3) {
        var f3 = c3.type;
        if (f3 === ya) return m2(a3, b3, c3.props.children, d3, c3.key);
        if (null !== b3 && (b3.elementType === f3 || "object" === typeof f3 && null !== f3 && f3.$$typeof === Ha && Ng(f3) === b3.type)) return d3 = e2(b3, c3.props), d3.ref = Lg(a3, b3, c3), d3.return = a3, d3;
        d3 = Rg(c3.type, c3.key, c3.props, null, a3.mode, d3);
        d3.ref = Lg(a3, b3, c3);
        d3.return = a3;
        return d3;
      }
      function l2(a3, b3, c3, d3) {
        if (null === b3 || 4 !== b3.tag || b3.stateNode.containerInfo !== c3.containerInfo || b3.stateNode.implementation !== c3.implementation) return b3 = Sg(c3, a3.mode, d3), b3.return = a3, b3;
        b3 = e2(b3, c3.children || []);
        b3.return = a3;
        return b3;
      }
      function m2(a3, b3, c3, d3, f3) {
        if (null === b3 || 7 !== b3.tag) return b3 = Tg(c3, a3.mode, d3, f3), b3.return = a3, b3;
        b3 = e2(b3, c3);
        b3.return = a3;
        return b3;
      }
      function q2(a3, b3, c3) {
        if ("string" === typeof b3 && "" !== b3 || "number" === typeof b3) return b3 = Qg("" + b3, a3.mode, c3), b3.return = a3, b3;
        if ("object" === typeof b3 && null !== b3) {
          switch (b3.$$typeof) {
            case va:
              return c3 = Rg(b3.type, b3.key, b3.props, null, a3.mode, c3), c3.ref = Lg(a3, null, b3), c3.return = a3, c3;
            case wa:
              return b3 = Sg(b3, a3.mode, c3), b3.return = a3, b3;
            case Ha:
              var d3 = b3._init;
              return q2(a3, d3(b3._payload), c3);
          }
          if (eb(b3) || Ka(b3)) return b3 = Tg(b3, a3.mode, c3, null), b3.return = a3, b3;
          Mg(a3, b3);
        }
        return null;
      }
      function r2(a3, b3, c3, d3) {
        var e3 = null !== b3 ? b3.key : null;
        if ("string" === typeof c3 && "" !== c3 || "number" === typeof c3) return null !== e3 ? null : h2(a3, b3, "" + c3, d3);
        if ("object" === typeof c3 && null !== c3) {
          switch (c3.$$typeof) {
            case va:
              return c3.key === e3 ? k2(a3, b3, c3, d3) : null;
            case wa:
              return c3.key === e3 ? l2(a3, b3, c3, d3) : null;
            case Ha:
              return e3 = c3._init, r2(
                a3,
                b3,
                e3(c3._payload),
                d3
              );
          }
          if (eb(c3) || Ka(c3)) return null !== e3 ? null : m2(a3, b3, c3, d3, null);
          Mg(a3, c3);
        }
        return null;
      }
      function y2(a3, b3, c3, d3, e3) {
        if ("string" === typeof d3 && "" !== d3 || "number" === typeof d3) return a3 = a3.get(c3) || null, h2(b3, a3, "" + d3, e3);
        if ("object" === typeof d3 && null !== d3) {
          switch (d3.$$typeof) {
            case va:
              return a3 = a3.get(null === d3.key ? c3 : d3.key) || null, k2(b3, a3, d3, e3);
            case wa:
              return a3 = a3.get(null === d3.key ? c3 : d3.key) || null, l2(b3, a3, d3, e3);
            case Ha:
              var f3 = d3._init;
              return y2(a3, b3, c3, f3(d3._payload), e3);
          }
          if (eb(d3) || Ka(d3)) return a3 = a3.get(c3) || null, m2(b3, a3, d3, e3, null);
          Mg(b3, d3);
        }
        return null;
      }
      function n2(e3, g3, h3, k3) {
        for (var l3 = null, m3 = null, u2 = g3, w2 = g3 = 0, x2 = null; null !== u2 && w2 < h3.length; w2++) {
          u2.index > w2 ? (x2 = u2, u2 = null) : x2 = u2.sibling;
          var n3 = r2(e3, u2, h3[w2], k3);
          if (null === n3) {
            null === u2 && (u2 = x2);
            break;
          }
          a2 && u2 && null === n3.alternate && b2(e3, u2);
          g3 = f2(n3, g3, w2);
          null === m3 ? l3 = n3 : m3.sibling = n3;
          m3 = n3;
          u2 = x2;
        }
        if (w2 === h3.length) return c2(e3, u2), I2 && tg(e3, w2), l3;
        if (null === u2) {
          for (; w2 < h3.length; w2++) u2 = q2(e3, h3[w2], k3), null !== u2 && (g3 = f2(u2, g3, w2), null === m3 ? l3 = u2 : m3.sibling = u2, m3 = u2);
          I2 && tg(e3, w2);
          return l3;
        }
        for (u2 = d2(e3, u2); w2 < h3.length; w2++) x2 = y2(u2, e3, w2, h3[w2], k3), null !== x2 && (a2 && null !== x2.alternate && u2.delete(null === x2.key ? w2 : x2.key), g3 = f2(x2, g3, w2), null === m3 ? l3 = x2 : m3.sibling = x2, m3 = x2);
        a2 && u2.forEach(function(a3) {
          return b2(e3, a3);
        });
        I2 && tg(e3, w2);
        return l3;
      }
      function t2(e3, g3, h3, k3) {
        var l3 = Ka(h3);
        if ("function" !== typeof l3) throw Error(p2(150));
        h3 = l3.call(h3);
        if (null == h3) throw Error(p2(151));
        for (var u2 = l3 = null, m3 = g3, w2 = g3 = 0, x2 = null, n3 = h3.next(); null !== m3 && !n3.done; w2++, n3 = h3.next()) {
          m3.index > w2 ? (x2 = m3, m3 = null) : x2 = m3.sibling;
          var t3 = r2(e3, m3, n3.value, k3);
          if (null === t3) {
            null === m3 && (m3 = x2);
            break;
          }
          a2 && m3 && null === t3.alternate && b2(e3, m3);
          g3 = f2(t3, g3, w2);
          null === u2 ? l3 = t3 : u2.sibling = t3;
          u2 = t3;
          m3 = x2;
        }
        if (n3.done) return c2(
          e3,
          m3
        ), I2 && tg(e3, w2), l3;
        if (null === m3) {
          for (; !n3.done; w2++, n3 = h3.next()) n3 = q2(e3, n3.value, k3), null !== n3 && (g3 = f2(n3, g3, w2), null === u2 ? l3 = n3 : u2.sibling = n3, u2 = n3);
          I2 && tg(e3, w2);
          return l3;
        }
        for (m3 = d2(e3, m3); !n3.done; w2++, n3 = h3.next()) n3 = y2(m3, e3, w2, n3.value, k3), null !== n3 && (a2 && null !== n3.alternate && m3.delete(null === n3.key ? w2 : n3.key), g3 = f2(n3, g3, w2), null === u2 ? l3 = n3 : u2.sibling = n3, u2 = n3);
        a2 && m3.forEach(function(a3) {
          return b2(e3, a3);
        });
        I2 && tg(e3, w2);
        return l3;
      }
      function J2(a3, d3, f3, h3) {
        "object" === typeof f3 && null !== f3 && f3.type === ya && null === f3.key && (f3 = f3.props.children);
        if ("object" === typeof f3 && null !== f3) {
          switch (f3.$$typeof) {
            case va:
              a: {
                for (var k3 = f3.key, l3 = d3; null !== l3; ) {
                  if (l3.key === k3) {
                    k3 = f3.type;
                    if (k3 === ya) {
                      if (7 === l3.tag) {
                        c2(a3, l3.sibling);
                        d3 = e2(l3, f3.props.children);
                        d3.return = a3;
                        a3 = d3;
                        break a;
                      }
                    } else if (l3.elementType === k3 || "object" === typeof k3 && null !== k3 && k3.$$typeof === Ha && Ng(k3) === l3.type) {
                      c2(a3, l3.sibling);
                      d3 = e2(l3, f3.props);
                      d3.ref = Lg(a3, l3, f3);
                      d3.return = a3;
                      a3 = d3;
                      break a;
                    }
                    c2(a3, l3);
                    break;
                  } else b2(a3, l3);
                  l3 = l3.sibling;
                }
                f3.type === ya ? (d3 = Tg(f3.props.children, a3.mode, h3, f3.key), d3.return = a3, a3 = d3) : (h3 = Rg(f3.type, f3.key, f3.props, null, a3.mode, h3), h3.ref = Lg(a3, d3, f3), h3.return = a3, a3 = h3);
              }
              return g2(a3);
            case wa:
              a: {
                for (l3 = f3.key; null !== d3; ) {
                  if (d3.key === l3) if (4 === d3.tag && d3.stateNode.containerInfo === f3.containerInfo && d3.stateNode.implementation === f3.implementation) {
                    c2(a3, d3.sibling);
                    d3 = e2(d3, f3.children || []);
                    d3.return = a3;
                    a3 = d3;
                    break a;
                  } else {
                    c2(a3, d3);
                    break;
                  }
                  else b2(a3, d3);
                  d3 = d3.sibling;
                }
                d3 = Sg(f3, a3.mode, h3);
                d3.return = a3;
                a3 = d3;
              }
              return g2(a3);
            case Ha:
              return l3 = f3._init, J2(a3, d3, l3(f3._payload), h3);
          }
          if (eb(f3)) return n2(a3, d3, f3, h3);
          if (Ka(f3)) return t2(a3, d3, f3, h3);
          Mg(a3, f3);
        }
        return "string" === typeof f3 && "" !== f3 || "number" === typeof f3 ? (f3 = "" + f3, null !== d3 && 6 === d3.tag ? (c2(a3, d3.sibling), d3 = e2(d3, f3), d3.return = a3, a3 = d3) : (c2(a3, d3), d3 = Qg(f3, a3.mode, h3), d3.return = a3, a3 = d3), g2(a3)) : c2(a3, d3);
      }
      return J2;
    }
    var Ug = Og(true), Vg = Og(false), Wg = Uf(null), Xg = null, Yg = null, Zg = null;
    function $g() {
      Zg = Yg = Xg = null;
    }
    function ah(a2) {
      var b2 = Wg.current;
      E2(Wg);
      a2._currentValue = b2;
    }
    function bh(a2, b2, c2) {
      for (; null !== a2; ) {
        var d2 = a2.alternate;
        (a2.childLanes & b2) !== b2 ? (a2.childLanes |= b2, null !== d2 && (d2.childLanes |= b2)) : null !== d2 && (d2.childLanes & b2) !== b2 && (d2.childLanes |= b2);
        if (a2 === c2) break;
        a2 = a2.return;
      }
    }
    function ch(a2, b2) {
      Xg = a2;
      Zg = Yg = null;
      a2 = a2.dependencies;
      null !== a2 && null !== a2.firstContext && (0 !== (a2.lanes & b2) && (dh = true), a2.firstContext = null);
    }
    function eh(a2) {
      var b2 = a2._currentValue;
      if (Zg !== a2) if (a2 = { context: a2, memoizedValue: b2, next: null }, null === Yg) {
        if (null === Xg) throw Error(p2(308));
        Yg = a2;
        Xg.dependencies = { lanes: 0, firstContext: a2 };
      } else Yg = Yg.next = a2;
      return b2;
    }
    var fh = null;
    function gh(a2) {
      null === fh ? fh = [a2] : fh.push(a2);
    }
    function hh(a2, b2, c2, d2) {
      var e2 = b2.interleaved;
      null === e2 ? (c2.next = c2, gh(b2)) : (c2.next = e2.next, e2.next = c2);
      b2.interleaved = c2;
      return ih(a2, d2);
    }
    function ih(a2, b2) {
      a2.lanes |= b2;
      var c2 = a2.alternate;
      null !== c2 && (c2.lanes |= b2);
      c2 = a2;
      for (a2 = a2.return; null !== a2; ) a2.childLanes |= b2, c2 = a2.alternate, null !== c2 && (c2.childLanes |= b2), c2 = a2, a2 = a2.return;
      return 3 === c2.tag ? c2.stateNode : null;
    }
    var jh = false;
    function kh(a2) {
      a2.updateQueue = { baseState: a2.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
    }
    function lh(a2, b2) {
      a2 = a2.updateQueue;
      b2.updateQueue === a2 && (b2.updateQueue = { baseState: a2.baseState, firstBaseUpdate: a2.firstBaseUpdate, lastBaseUpdate: a2.lastBaseUpdate, shared: a2.shared, effects: a2.effects });
    }
    function mh(a2, b2) {
      return { eventTime: a2, lane: b2, tag: 0, payload: null, callback: null, next: null };
    }
    function nh(a2, b2, c2) {
      var d2 = a2.updateQueue;
      if (null === d2) return null;
      d2 = d2.shared;
      if (0 !== (K2 & 2)) {
        var e2 = d2.pending;
        null === e2 ? b2.next = b2 : (b2.next = e2.next, e2.next = b2);
        d2.pending = b2;
        return ih(a2, c2);
      }
      e2 = d2.interleaved;
      null === e2 ? (b2.next = b2, gh(d2)) : (b2.next = e2.next, e2.next = b2);
      d2.interleaved = b2;
      return ih(a2, c2);
    }
    function oh(a2, b2, c2) {
      b2 = b2.updateQueue;
      if (null !== b2 && (b2 = b2.shared, 0 !== (c2 & 4194240))) {
        var d2 = b2.lanes;
        d2 &= a2.pendingLanes;
        c2 |= d2;
        b2.lanes = c2;
        Cc(a2, c2);
      }
    }
    function ph(a2, b2) {
      var c2 = a2.updateQueue, d2 = a2.alternate;
      if (null !== d2 && (d2 = d2.updateQueue, c2 === d2)) {
        var e2 = null, f2 = null;
        c2 = c2.firstBaseUpdate;
        if (null !== c2) {
          do {
            var g2 = { eventTime: c2.eventTime, lane: c2.lane, tag: c2.tag, payload: c2.payload, callback: c2.callback, next: null };
            null === f2 ? e2 = f2 = g2 : f2 = f2.next = g2;
            c2 = c2.next;
          } while (null !== c2);
          null === f2 ? e2 = f2 = b2 : f2 = f2.next = b2;
        } else e2 = f2 = b2;
        c2 = { baseState: d2.baseState, firstBaseUpdate: e2, lastBaseUpdate: f2, shared: d2.shared, effects: d2.effects };
        a2.updateQueue = c2;
        return;
      }
      a2 = c2.lastBaseUpdate;
      null === a2 ? c2.firstBaseUpdate = b2 : a2.next = b2;
      c2.lastBaseUpdate = b2;
    }
    function qh(a2, b2, c2, d2) {
      var e2 = a2.updateQueue;
      jh = false;
      var f2 = e2.firstBaseUpdate, g2 = e2.lastBaseUpdate, h2 = e2.shared.pending;
      if (null !== h2) {
        e2.shared.pending = null;
        var k2 = h2, l2 = k2.next;
        k2.next = null;
        null === g2 ? f2 = l2 : g2.next = l2;
        g2 = k2;
        var m2 = a2.alternate;
        null !== m2 && (m2 = m2.updateQueue, h2 = m2.lastBaseUpdate, h2 !== g2 && (null === h2 ? m2.firstBaseUpdate = l2 : h2.next = l2, m2.lastBaseUpdate = k2));
      }
      if (null !== f2) {
        var q2 = e2.baseState;
        g2 = 0;
        m2 = l2 = k2 = null;
        h2 = f2;
        do {
          var r2 = h2.lane, y2 = h2.eventTime;
          if ((d2 & r2) === r2) {
            null !== m2 && (m2 = m2.next = {
              eventTime: y2,
              lane: 0,
              tag: h2.tag,
              payload: h2.payload,
              callback: h2.callback,
              next: null
            });
            a: {
              var n2 = a2, t2 = h2;
              r2 = b2;
              y2 = c2;
              switch (t2.tag) {
                case 1:
                  n2 = t2.payload;
                  if ("function" === typeof n2) {
                    q2 = n2.call(y2, q2, r2);
                    break a;
                  }
                  q2 = n2;
                  break a;
                case 3:
                  n2.flags = n2.flags & -65537 | 128;
                case 0:
                  n2 = t2.payload;
                  r2 = "function" === typeof n2 ? n2.call(y2, q2, r2) : n2;
                  if (null === r2 || void 0 === r2) break a;
                  q2 = A2({}, q2, r2);
                  break a;
                case 2:
                  jh = true;
              }
            }
            null !== h2.callback && 0 !== h2.lane && (a2.flags |= 64, r2 = e2.effects, null === r2 ? e2.effects = [h2] : r2.push(h2));
          } else y2 = { eventTime: y2, lane: r2, tag: h2.tag, payload: h2.payload, callback: h2.callback, next: null }, null === m2 ? (l2 = m2 = y2, k2 = q2) : m2 = m2.next = y2, g2 |= r2;
          h2 = h2.next;
          if (null === h2) if (h2 = e2.shared.pending, null === h2) break;
          else r2 = h2, h2 = r2.next, r2.next = null, e2.lastBaseUpdate = r2, e2.shared.pending = null;
        } while (1);
        null === m2 && (k2 = q2);
        e2.baseState = k2;
        e2.firstBaseUpdate = l2;
        e2.lastBaseUpdate = m2;
        b2 = e2.shared.interleaved;
        if (null !== b2) {
          e2 = b2;
          do
            g2 |= e2.lane, e2 = e2.next;
          while (e2 !== b2);
        } else null === f2 && (e2.shared.lanes = 0);
        rh |= g2;
        a2.lanes = g2;
        a2.memoizedState = q2;
      }
    }
    function sh(a2, b2, c2) {
      a2 = b2.effects;
      b2.effects = null;
      if (null !== a2) for (b2 = 0; b2 < a2.length; b2++) {
        var d2 = a2[b2], e2 = d2.callback;
        if (null !== e2) {
          d2.callback = null;
          d2 = c2;
          if ("function" !== typeof e2) throw Error(p2(191, e2));
          e2.call(d2);
        }
      }
    }
    var th = {}, uh = Uf(th), vh = Uf(th), wh = Uf(th);
    function xh(a2) {
      if (a2 === th) throw Error(p2(174));
      return a2;
    }
    function yh(a2, b2) {
      G2(wh, b2);
      G2(vh, a2);
      G2(uh, th);
      a2 = b2.nodeType;
      switch (a2) {
        case 9:
        case 11:
          b2 = (b2 = b2.documentElement) ? b2.namespaceURI : lb(null, "");
          break;
        default:
          a2 = 8 === a2 ? b2.parentNode : b2, b2 = a2.namespaceURI || null, a2 = a2.tagName, b2 = lb(b2, a2);
      }
      E2(uh);
      G2(uh, b2);
    }
    function zh() {
      E2(uh);
      E2(vh);
      E2(wh);
    }
    function Ah(a2) {
      xh(wh.current);
      var b2 = xh(uh.current);
      var c2 = lb(b2, a2.type);
      b2 !== c2 && (G2(vh, a2), G2(uh, c2));
    }
    function Bh(a2) {
      vh.current === a2 && (E2(uh), E2(vh));
    }
    var L2 = Uf(0);
    function Ch(a2) {
      for (var b2 = a2; null !== b2; ) {
        if (13 === b2.tag) {
          var c2 = b2.memoizedState;
          if (null !== c2 && (c2 = c2.dehydrated, null === c2 || "$?" === c2.data || "$!" === c2.data)) return b2;
        } else if (19 === b2.tag && void 0 !== b2.memoizedProps.revealOrder) {
          if (0 !== (b2.flags & 128)) return b2;
        } else if (null !== b2.child) {
          b2.child.return = b2;
          b2 = b2.child;
          continue;
        }
        if (b2 === a2) break;
        for (; null === b2.sibling; ) {
          if (null === b2.return || b2.return === a2) return null;
          b2 = b2.return;
        }
        b2.sibling.return = b2.return;
        b2 = b2.sibling;
      }
      return null;
    }
    var Dh = [];
    function Eh() {
      for (var a2 = 0; a2 < Dh.length; a2++) Dh[a2]._workInProgressVersionPrimary = null;
      Dh.length = 0;
    }
    var Fh = ua.ReactCurrentDispatcher, Gh = ua.ReactCurrentBatchConfig, Hh = 0, M2 = null, N2 = null, O2 = null, Ih = false, Jh = false, Kh = 0, Lh = 0;
    function P2() {
      throw Error(p2(321));
    }
    function Mh(a2, b2) {
      if (null === b2) return false;
      for (var c2 = 0; c2 < b2.length && c2 < a2.length; c2++) if (!He2(a2[c2], b2[c2])) return false;
      return true;
    }
    function Nh(a2, b2, c2, d2, e2, f2) {
      Hh = f2;
      M2 = b2;
      b2.memoizedState = null;
      b2.updateQueue = null;
      b2.lanes = 0;
      Fh.current = null === a2 || null === a2.memoizedState ? Oh : Ph;
      a2 = c2(d2, e2);
      if (Jh) {
        f2 = 0;
        do {
          Jh = false;
          Kh = 0;
          if (25 <= f2) throw Error(p2(301));
          f2 += 1;
          O2 = N2 = null;
          b2.updateQueue = null;
          Fh.current = Qh;
          a2 = c2(d2, e2);
        } while (Jh);
      }
      Fh.current = Rh;
      b2 = null !== N2 && null !== N2.next;
      Hh = 0;
      O2 = N2 = M2 = null;
      Ih = false;
      if (b2) throw Error(p2(300));
      return a2;
    }
    function Sh() {
      var a2 = 0 !== Kh;
      Kh = 0;
      return a2;
    }
    function Th() {
      var a2 = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
      null === O2 ? M2.memoizedState = O2 = a2 : O2 = O2.next = a2;
      return O2;
    }
    function Uh() {
      if (null === N2) {
        var a2 = M2.alternate;
        a2 = null !== a2 ? a2.memoizedState : null;
      } else a2 = N2.next;
      var b2 = null === O2 ? M2.memoizedState : O2.next;
      if (null !== b2) O2 = b2, N2 = a2;
      else {
        if (null === a2) throw Error(p2(310));
        N2 = a2;
        a2 = { memoizedState: N2.memoizedState, baseState: N2.baseState, baseQueue: N2.baseQueue, queue: N2.queue, next: null };
        null === O2 ? M2.memoizedState = O2 = a2 : O2 = O2.next = a2;
      }
      return O2;
    }
    function Vh(a2, b2) {
      return "function" === typeof b2 ? b2(a2) : b2;
    }
    function Wh(a2) {
      var b2 = Uh(), c2 = b2.queue;
      if (null === c2) throw Error(p2(311));
      c2.lastRenderedReducer = a2;
      var d2 = N2, e2 = d2.baseQueue, f2 = c2.pending;
      if (null !== f2) {
        if (null !== e2) {
          var g2 = e2.next;
          e2.next = f2.next;
          f2.next = g2;
        }
        d2.baseQueue = e2 = f2;
        c2.pending = null;
      }
      if (null !== e2) {
        f2 = e2.next;
        d2 = d2.baseState;
        var h2 = g2 = null, k2 = null, l2 = f2;
        do {
          var m2 = l2.lane;
          if ((Hh & m2) === m2) null !== k2 && (k2 = k2.next = { lane: 0, action: l2.action, hasEagerState: l2.hasEagerState, eagerState: l2.eagerState, next: null }), d2 = l2.hasEagerState ? l2.eagerState : a2(d2, l2.action);
          else {
            var q2 = {
              lane: m2,
              action: l2.action,
              hasEagerState: l2.hasEagerState,
              eagerState: l2.eagerState,
              next: null
            };
            null === k2 ? (h2 = k2 = q2, g2 = d2) : k2 = k2.next = q2;
            M2.lanes |= m2;
            rh |= m2;
          }
          l2 = l2.next;
        } while (null !== l2 && l2 !== f2);
        null === k2 ? g2 = d2 : k2.next = h2;
        He2(d2, b2.memoizedState) || (dh = true);
        b2.memoizedState = d2;
        b2.baseState = g2;
        b2.baseQueue = k2;
        c2.lastRenderedState = d2;
      }
      a2 = c2.interleaved;
      if (null !== a2) {
        e2 = a2;
        do
          f2 = e2.lane, M2.lanes |= f2, rh |= f2, e2 = e2.next;
        while (e2 !== a2);
      } else null === e2 && (c2.lanes = 0);
      return [b2.memoizedState, c2.dispatch];
    }
    function Xh(a2) {
      var b2 = Uh(), c2 = b2.queue;
      if (null === c2) throw Error(p2(311));
      c2.lastRenderedReducer = a2;
      var d2 = c2.dispatch, e2 = c2.pending, f2 = b2.memoizedState;
      if (null !== e2) {
        c2.pending = null;
        var g2 = e2 = e2.next;
        do
          f2 = a2(f2, g2.action), g2 = g2.next;
        while (g2 !== e2);
        He2(f2, b2.memoizedState) || (dh = true);
        b2.memoizedState = f2;
        null === b2.baseQueue && (b2.baseState = f2);
        c2.lastRenderedState = f2;
      }
      return [f2, d2];
    }
    function Yh() {
    }
    function Zh(a2, b2) {
      var c2 = M2, d2 = Uh(), e2 = b2(), f2 = !He2(d2.memoizedState, e2);
      f2 && (d2.memoizedState = e2, dh = true);
      d2 = d2.queue;
      $h(ai2.bind(null, c2, d2, a2), [a2]);
      if (d2.getSnapshot !== b2 || f2 || null !== O2 && O2.memoizedState.tag & 1) {
        c2.flags |= 2048;
        bi2(9, ci2.bind(null, c2, d2, e2, b2), void 0, null);
        if (null === Q2) throw Error(p2(349));
        0 !== (Hh & 30) || di2(c2, b2, e2);
      }
      return e2;
    }
    function di2(a2, b2, c2) {
      a2.flags |= 16384;
      a2 = { getSnapshot: b2, value: c2 };
      b2 = M2.updateQueue;
      null === b2 ? (b2 = { lastEffect: null, stores: null }, M2.updateQueue = b2, b2.stores = [a2]) : (c2 = b2.stores, null === c2 ? b2.stores = [a2] : c2.push(a2));
    }
    function ci2(a2, b2, c2, d2) {
      b2.value = c2;
      b2.getSnapshot = d2;
      ei2(b2) && fi2(a2);
    }
    function ai2(a2, b2, c2) {
      return c2(function() {
        ei2(b2) && fi2(a2);
      });
    }
    function ei2(a2) {
      var b2 = a2.getSnapshot;
      a2 = a2.value;
      try {
        var c2 = b2();
        return !He2(a2, c2);
      } catch (d2) {
        return true;
      }
    }
    function fi2(a2) {
      var b2 = ih(a2, 1);
      null !== b2 && gi2(b2, a2, 1, -1);
    }
    function hi2(a2) {
      var b2 = Th();
      "function" === typeof a2 && (a2 = a2());
      b2.memoizedState = b2.baseState = a2;
      a2 = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: Vh, lastRenderedState: a2 };
      b2.queue = a2;
      a2 = a2.dispatch = ii2.bind(null, M2, a2);
      return [b2.memoizedState, a2];
    }
    function bi2(a2, b2, c2, d2) {
      a2 = { tag: a2, create: b2, destroy: c2, deps: d2, next: null };
      b2 = M2.updateQueue;
      null === b2 ? (b2 = { lastEffect: null, stores: null }, M2.updateQueue = b2, b2.lastEffect = a2.next = a2) : (c2 = b2.lastEffect, null === c2 ? b2.lastEffect = a2.next = a2 : (d2 = c2.next, c2.next = a2, a2.next = d2, b2.lastEffect = a2));
      return a2;
    }
    function ji2() {
      return Uh().memoizedState;
    }
    function ki2(a2, b2, c2, d2) {
      var e2 = Th();
      M2.flags |= a2;
      e2.memoizedState = bi2(1 | b2, c2, void 0, void 0 === d2 ? null : d2);
    }
    function li2(a2, b2, c2, d2) {
      var e2 = Uh();
      d2 = void 0 === d2 ? null : d2;
      var f2 = void 0;
      if (null !== N2) {
        var g2 = N2.memoizedState;
        f2 = g2.destroy;
        if (null !== d2 && Mh(d2, g2.deps)) {
          e2.memoizedState = bi2(b2, c2, f2, d2);
          return;
        }
      }
      M2.flags |= a2;
      e2.memoizedState = bi2(1 | b2, c2, f2, d2);
    }
    function mi2(a2, b2) {
      return ki2(8390656, 8, a2, b2);
    }
    function $h(a2, b2) {
      return li2(2048, 8, a2, b2);
    }
    function ni2(a2, b2) {
      return li2(4, 2, a2, b2);
    }
    function oi2(a2, b2) {
      return li2(4, 4, a2, b2);
    }
    function pi2(a2, b2) {
      if ("function" === typeof b2) return a2 = a2(), b2(a2), function() {
        b2(null);
      };
      if (null !== b2 && void 0 !== b2) return a2 = a2(), b2.current = a2, function() {
        b2.current = null;
      };
    }
    function qi2(a2, b2, c2) {
      c2 = null !== c2 && void 0 !== c2 ? c2.concat([a2]) : null;
      return li2(4, 4, pi2.bind(null, b2, a2), c2);
    }
    function ri2() {
    }
    function si2(a2, b2) {
      var c2 = Uh();
      b2 = void 0 === b2 ? null : b2;
      var d2 = c2.memoizedState;
      if (null !== d2 && null !== b2 && Mh(b2, d2[1])) return d2[0];
      c2.memoizedState = [a2, b2];
      return a2;
    }
    function ti2(a2, b2) {
      var c2 = Uh();
      b2 = void 0 === b2 ? null : b2;
      var d2 = c2.memoizedState;
      if (null !== d2 && null !== b2 && Mh(b2, d2[1])) return d2[0];
      a2 = a2();
      c2.memoizedState = [a2, b2];
      return a2;
    }
    function ui2(a2, b2, c2) {
      if (0 === (Hh & 21)) return a2.baseState && (a2.baseState = false, dh = true), a2.memoizedState = c2;
      He2(c2, b2) || (c2 = yc(), M2.lanes |= c2, rh |= c2, a2.baseState = true);
      return b2;
    }
    function vi2(a2, b2) {
      var c2 = C2;
      C2 = 0 !== c2 && 4 > c2 ? c2 : 4;
      a2(true);
      var d2 = Gh.transition;
      Gh.transition = {};
      try {
        a2(false), b2();
      } finally {
        C2 = c2, Gh.transition = d2;
      }
    }
    function wi2() {
      return Uh().memoizedState;
    }
    function xi2(a2, b2, c2) {
      var d2 = yi2(a2);
      c2 = { lane: d2, action: c2, hasEagerState: false, eagerState: null, next: null };
      if (zi2(a2)) Ai2(b2, c2);
      else if (c2 = hh(a2, b2, c2, d2), null !== c2) {
        var e2 = R2();
        gi2(c2, a2, d2, e2);
        Bi2(c2, b2, d2);
      }
    }
    function ii2(a2, b2, c2) {
      var d2 = yi2(a2), e2 = { lane: d2, action: c2, hasEagerState: false, eagerState: null, next: null };
      if (zi2(a2)) Ai2(b2, e2);
      else {
        var f2 = a2.alternate;
        if (0 === a2.lanes && (null === f2 || 0 === f2.lanes) && (f2 = b2.lastRenderedReducer, null !== f2)) try {
          var g2 = b2.lastRenderedState, h2 = f2(g2, c2);
          e2.hasEagerState = true;
          e2.eagerState = h2;
          if (He2(h2, g2)) {
            var k2 = b2.interleaved;
            null === k2 ? (e2.next = e2, gh(b2)) : (e2.next = k2.next, k2.next = e2);
            b2.interleaved = e2;
            return;
          }
        } catch (l2) {
        } finally {
        }
        c2 = hh(a2, b2, e2, d2);
        null !== c2 && (e2 = R2(), gi2(c2, a2, d2, e2), Bi2(c2, b2, d2));
      }
    }
    function zi2(a2) {
      var b2 = a2.alternate;
      return a2 === M2 || null !== b2 && b2 === M2;
    }
    function Ai2(a2, b2) {
      Jh = Ih = true;
      var c2 = a2.pending;
      null === c2 ? b2.next = b2 : (b2.next = c2.next, c2.next = b2);
      a2.pending = b2;
    }
    function Bi2(a2, b2, c2) {
      if (0 !== (c2 & 4194240)) {
        var d2 = b2.lanes;
        d2 &= a2.pendingLanes;
        c2 |= d2;
        b2.lanes = c2;
        Cc(a2, c2);
      }
    }
    var Rh = { readContext: eh, useCallback: P2, useContext: P2, useEffect: P2, useImperativeHandle: P2, useInsertionEffect: P2, useLayoutEffect: P2, useMemo: P2, useReducer: P2, useRef: P2, useState: P2, useDebugValue: P2, useDeferredValue: P2, useTransition: P2, useMutableSource: P2, useSyncExternalStore: P2, useId: P2, unstable_isNewReconciler: false }, Oh = { readContext: eh, useCallback: function(a2, b2) {
      Th().memoizedState = [a2, void 0 === b2 ? null : b2];
      return a2;
    }, useContext: eh, useEffect: mi2, useImperativeHandle: function(a2, b2, c2) {
      c2 = null !== c2 && void 0 !== c2 ? c2.concat([a2]) : null;
      return ki2(
        4194308,
        4,
        pi2.bind(null, b2, a2),
        c2
      );
    }, useLayoutEffect: function(a2, b2) {
      return ki2(4194308, 4, a2, b2);
    }, useInsertionEffect: function(a2, b2) {
      return ki2(4, 2, a2, b2);
    }, useMemo: function(a2, b2) {
      var c2 = Th();
      b2 = void 0 === b2 ? null : b2;
      a2 = a2();
      c2.memoizedState = [a2, b2];
      return a2;
    }, useReducer: function(a2, b2, c2) {
      var d2 = Th();
      b2 = void 0 !== c2 ? c2(b2) : b2;
      d2.memoizedState = d2.baseState = b2;
      a2 = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: a2, lastRenderedState: b2 };
      d2.queue = a2;
      a2 = a2.dispatch = xi2.bind(null, M2, a2);
      return [d2.memoizedState, a2];
    }, useRef: function(a2) {
      var b2 = Th();
      a2 = { current: a2 };
      return b2.memoizedState = a2;
    }, useState: hi2, useDebugValue: ri2, useDeferredValue: function(a2) {
      return Th().memoizedState = a2;
    }, useTransition: function() {
      var a2 = hi2(false), b2 = a2[0];
      a2 = vi2.bind(null, a2[1]);
      Th().memoizedState = a2;
      return [b2, a2];
    }, useMutableSource: function() {
    }, useSyncExternalStore: function(a2, b2, c2) {
      var d2 = M2, e2 = Th();
      if (I2) {
        if (void 0 === c2) throw Error(p2(407));
        c2 = c2();
      } else {
        c2 = b2();
        if (null === Q2) throw Error(p2(349));
        0 !== (Hh & 30) || di2(d2, b2, c2);
      }
      e2.memoizedState = c2;
      var f2 = { value: c2, getSnapshot: b2 };
      e2.queue = f2;
      mi2(ai2.bind(
        null,
        d2,
        f2,
        a2
      ), [a2]);
      d2.flags |= 2048;
      bi2(9, ci2.bind(null, d2, f2, c2, b2), void 0, null);
      return c2;
    }, useId: function() {
      var a2 = Th(), b2 = Q2.identifierPrefix;
      if (I2) {
        var c2 = sg;
        var d2 = rg;
        c2 = (d2 & ~(1 << 32 - oc(d2) - 1)).toString(32) + c2;
        b2 = ":" + b2 + "R" + c2;
        c2 = Kh++;
        0 < c2 && (b2 += "H" + c2.toString(32));
        b2 += ":";
      } else c2 = Lh++, b2 = ":" + b2 + "r" + c2.toString(32) + ":";
      return a2.memoizedState = b2;
    }, unstable_isNewReconciler: false }, Ph = {
      readContext: eh,
      useCallback: si2,
      useContext: eh,
      useEffect: $h,
      useImperativeHandle: qi2,
      useInsertionEffect: ni2,
      useLayoutEffect: oi2,
      useMemo: ti2,
      useReducer: Wh,
      useRef: ji2,
      useState: function() {
        return Wh(Vh);
      },
      useDebugValue: ri2,
      useDeferredValue: function(a2) {
        var b2 = Uh();
        return ui2(b2, N2.memoizedState, a2);
      },
      useTransition: function() {
        var a2 = Wh(Vh)[0], b2 = Uh().memoizedState;
        return [a2, b2];
      },
      useMutableSource: Yh,
      useSyncExternalStore: Zh,
      useId: wi2,
      unstable_isNewReconciler: false
    }, Qh = { readContext: eh, useCallback: si2, useContext: eh, useEffect: $h, useImperativeHandle: qi2, useInsertionEffect: ni2, useLayoutEffect: oi2, useMemo: ti2, useReducer: Xh, useRef: ji2, useState: function() {
      return Xh(Vh);
    }, useDebugValue: ri2, useDeferredValue: function(a2) {
      var b2 = Uh();
      return null === N2 ? b2.memoizedState = a2 : ui2(b2, N2.memoizedState, a2);
    }, useTransition: function() {
      var a2 = Xh(Vh)[0], b2 = Uh().memoizedState;
      return [a2, b2];
    }, useMutableSource: Yh, useSyncExternalStore: Zh, useId: wi2, unstable_isNewReconciler: false };
    function Ci2(a2, b2) {
      if (a2 && a2.defaultProps) {
        b2 = A2({}, b2);
        a2 = a2.defaultProps;
        for (var c2 in a2) void 0 === b2[c2] && (b2[c2] = a2[c2]);
        return b2;
      }
      return b2;
    }
    function Di(a2, b2, c2, d2) {
      b2 = a2.memoizedState;
      c2 = c2(d2, b2);
      c2 = null === c2 || void 0 === c2 ? b2 : A2({}, b2, c2);
      a2.memoizedState = c2;
      0 === a2.lanes && (a2.updateQueue.baseState = c2);
    }
    var Ei2 = { isMounted: function(a2) {
      return (a2 = a2._reactInternals) ? Vb(a2) === a2 : false;
    }, enqueueSetState: function(a2, b2, c2) {
      a2 = a2._reactInternals;
      var d2 = R2(), e2 = yi2(a2), f2 = mh(d2, e2);
      f2.payload = b2;
      void 0 !== c2 && null !== c2 && (f2.callback = c2);
      b2 = nh(a2, f2, e2);
      null !== b2 && (gi2(b2, a2, e2, d2), oh(b2, a2, e2));
    }, enqueueReplaceState: function(a2, b2, c2) {
      a2 = a2._reactInternals;
      var d2 = R2(), e2 = yi2(a2), f2 = mh(d2, e2);
      f2.tag = 1;
      f2.payload = b2;
      void 0 !== c2 && null !== c2 && (f2.callback = c2);
      b2 = nh(a2, f2, e2);
      null !== b2 && (gi2(b2, a2, e2, d2), oh(b2, a2, e2));
    }, enqueueForceUpdate: function(a2, b2) {
      a2 = a2._reactInternals;
      var c2 = R2(), d2 = yi2(a2), e2 = mh(c2, d2);
      e2.tag = 2;
      void 0 !== b2 && null !== b2 && (e2.callback = b2);
      b2 = nh(a2, e2, d2);
      null !== b2 && (gi2(b2, a2, d2, c2), oh(b2, a2, d2));
    } };
    function Fi2(a2, b2, c2, d2, e2, f2, g2) {
      a2 = a2.stateNode;
      return "function" === typeof a2.shouldComponentUpdate ? a2.shouldComponentUpdate(d2, f2, g2) : b2.prototype && b2.prototype.isPureReactComponent ? !Ie2(c2, d2) || !Ie2(e2, f2) : true;
    }
    function Gi2(a2, b2, c2) {
      var d2 = false, e2 = Vf;
      var f2 = b2.contextType;
      "object" === typeof f2 && null !== f2 ? f2 = eh(f2) : (e2 = Zf(b2) ? Xf : H2.current, d2 = b2.contextTypes, f2 = (d2 = null !== d2 && void 0 !== d2) ? Yf(a2, e2) : Vf);
      b2 = new b2(c2, f2);
      a2.memoizedState = null !== b2.state && void 0 !== b2.state ? b2.state : null;
      b2.updater = Ei2;
      a2.stateNode = b2;
      b2._reactInternals = a2;
      d2 && (a2 = a2.stateNode, a2.__reactInternalMemoizedUnmaskedChildContext = e2, a2.__reactInternalMemoizedMaskedChildContext = f2);
      return b2;
    }
    function Hi2(a2, b2, c2, d2) {
      a2 = b2.state;
      "function" === typeof b2.componentWillReceiveProps && b2.componentWillReceiveProps(c2, d2);
      "function" === typeof b2.UNSAFE_componentWillReceiveProps && b2.UNSAFE_componentWillReceiveProps(c2, d2);
      b2.state !== a2 && Ei2.enqueueReplaceState(b2, b2.state, null);
    }
    function Ii2(a2, b2, c2, d2) {
      var e2 = a2.stateNode;
      e2.props = c2;
      e2.state = a2.memoizedState;
      e2.refs = {};
      kh(a2);
      var f2 = b2.contextType;
      "object" === typeof f2 && null !== f2 ? e2.context = eh(f2) : (f2 = Zf(b2) ? Xf : H2.current, e2.context = Yf(a2, f2));
      e2.state = a2.memoizedState;
      f2 = b2.getDerivedStateFromProps;
      "function" === typeof f2 && (Di(a2, b2, f2, c2), e2.state = a2.memoizedState);
      "function" === typeof b2.getDerivedStateFromProps || "function" === typeof e2.getSnapshotBeforeUpdate || "function" !== typeof e2.UNSAFE_componentWillMount && "function" !== typeof e2.componentWillMount || (b2 = e2.state, "function" === typeof e2.componentWillMount && e2.componentWillMount(), "function" === typeof e2.UNSAFE_componentWillMount && e2.UNSAFE_componentWillMount(), b2 !== e2.state && Ei2.enqueueReplaceState(e2, e2.state, null), qh(a2, c2, e2, d2), e2.state = a2.memoizedState);
      "function" === typeof e2.componentDidMount && (a2.flags |= 4194308);
    }
    function Ji2(a2, b2) {
      try {
        var c2 = "", d2 = b2;
        do
          c2 += Pa(d2), d2 = d2.return;
        while (d2);
        var e2 = c2;
      } catch (f2) {
        e2 = "\nError generating stack: " + f2.message + "\n" + f2.stack;
      }
      return { value: a2, source: b2, stack: e2, digest: null };
    }
    function Ki(a2, b2, c2) {
      return { value: a2, source: null, stack: null != c2 ? c2 : null, digest: null != b2 ? b2 : null };
    }
    function Li2(a2, b2) {
      try {
        console.error(b2.value);
      } catch (c2) {
        setTimeout(function() {
          throw c2;
        });
      }
    }
    var Mi2 = "function" === typeof WeakMap ? WeakMap : Map;
    function Ni2(a2, b2, c2) {
      c2 = mh(-1, c2);
      c2.tag = 3;
      c2.payload = { element: null };
      var d2 = b2.value;
      c2.callback = function() {
        Oi2 || (Oi2 = true, Pi2 = d2);
        Li2(a2, b2);
      };
      return c2;
    }
    function Qi2(a2, b2, c2) {
      c2 = mh(-1, c2);
      c2.tag = 3;
      var d2 = a2.type.getDerivedStateFromError;
      if ("function" === typeof d2) {
        var e2 = b2.value;
        c2.payload = function() {
          return d2(e2);
        };
        c2.callback = function() {
          Li2(a2, b2);
        };
      }
      var f2 = a2.stateNode;
      null !== f2 && "function" === typeof f2.componentDidCatch && (c2.callback = function() {
        Li2(a2, b2);
        "function" !== typeof d2 && (null === Ri2 ? Ri2 = /* @__PURE__ */ new Set([this]) : Ri2.add(this));
        var c3 = b2.stack;
        this.componentDidCatch(b2.value, { componentStack: null !== c3 ? c3 : "" });
      });
      return c2;
    }
    function Si2(a2, b2, c2) {
      var d2 = a2.pingCache;
      if (null === d2) {
        d2 = a2.pingCache = new Mi2();
        var e2 = /* @__PURE__ */ new Set();
        d2.set(b2, e2);
      } else e2 = d2.get(b2), void 0 === e2 && (e2 = /* @__PURE__ */ new Set(), d2.set(b2, e2));
      e2.has(c2) || (e2.add(c2), a2 = Ti2.bind(null, a2, b2, c2), b2.then(a2, a2));
    }
    function Ui2(a2) {
      do {
        var b2;
        if (b2 = 13 === a2.tag) b2 = a2.memoizedState, b2 = null !== b2 ? null !== b2.dehydrated ? true : false : true;
        if (b2) return a2;
        a2 = a2.return;
      } while (null !== a2);
      return null;
    }
    function Vi2(a2, b2, c2, d2, e2) {
      if (0 === (a2.mode & 1)) return a2 === b2 ? a2.flags |= 65536 : (a2.flags |= 128, c2.flags |= 131072, c2.flags &= -52805, 1 === c2.tag && (null === c2.alternate ? c2.tag = 17 : (b2 = mh(-1, 1), b2.tag = 2, nh(c2, b2, 1))), c2.lanes |= 1), a2;
      a2.flags |= 65536;
      a2.lanes = e2;
      return a2;
    }
    var Wi2 = ua.ReactCurrentOwner, dh = false;
    function Xi2(a2, b2, c2, d2) {
      b2.child = null === a2 ? Vg(b2, null, c2, d2) : Ug(b2, a2.child, c2, d2);
    }
    function Yi2(a2, b2, c2, d2, e2) {
      c2 = c2.render;
      var f2 = b2.ref;
      ch(b2, e2);
      d2 = Nh(a2, b2, c2, d2, f2, e2);
      c2 = Sh();
      if (null !== a2 && !dh) return b2.updateQueue = a2.updateQueue, b2.flags &= -2053, a2.lanes &= ~e2, Zi2(a2, b2, e2);
      I2 && c2 && vg(b2);
      b2.flags |= 1;
      Xi2(a2, b2, d2, e2);
      return b2.child;
    }
    function $i2(a2, b2, c2, d2, e2) {
      if (null === a2) {
        var f2 = c2.type;
        if ("function" === typeof f2 && !aj(f2) && void 0 === f2.defaultProps && null === c2.compare && void 0 === c2.defaultProps) return b2.tag = 15, b2.type = f2, bj(a2, b2, f2, d2, e2);
        a2 = Rg(c2.type, null, d2, b2, b2.mode, e2);
        a2.ref = b2.ref;
        a2.return = b2;
        return b2.child = a2;
      }
      f2 = a2.child;
      if (0 === (a2.lanes & e2)) {
        var g2 = f2.memoizedProps;
        c2 = c2.compare;
        c2 = null !== c2 ? c2 : Ie2;
        if (c2(g2, d2) && a2.ref === b2.ref) return Zi2(a2, b2, e2);
      }
      b2.flags |= 1;
      a2 = Pg(f2, d2);
      a2.ref = b2.ref;
      a2.return = b2;
      return b2.child = a2;
    }
    function bj(a2, b2, c2, d2, e2) {
      if (null !== a2) {
        var f2 = a2.memoizedProps;
        if (Ie2(f2, d2) && a2.ref === b2.ref) if (dh = false, b2.pendingProps = d2 = f2, 0 !== (a2.lanes & e2)) 0 !== (a2.flags & 131072) && (dh = true);
        else return b2.lanes = a2.lanes, Zi2(a2, b2, e2);
      }
      return cj(a2, b2, c2, d2, e2);
    }
    function dj(a2, b2, c2) {
      var d2 = b2.pendingProps, e2 = d2.children, f2 = null !== a2 ? a2.memoizedState : null;
      if ("hidden" === d2.mode) if (0 === (b2.mode & 1)) b2.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, G2(ej, fj), fj |= c2;
      else {
        if (0 === (c2 & 1073741824)) return a2 = null !== f2 ? f2.baseLanes | c2 : c2, b2.lanes = b2.childLanes = 1073741824, b2.memoizedState = { baseLanes: a2, cachePool: null, transitions: null }, b2.updateQueue = null, G2(ej, fj), fj |= a2, null;
        b2.memoizedState = { baseLanes: 0, cachePool: null, transitions: null };
        d2 = null !== f2 ? f2.baseLanes : c2;
        G2(ej, fj);
        fj |= d2;
      }
      else null !== f2 ? (d2 = f2.baseLanes | c2, b2.memoizedState = null) : d2 = c2, G2(ej, fj), fj |= d2;
      Xi2(a2, b2, e2, c2);
      return b2.child;
    }
    function gj(a2, b2) {
      var c2 = b2.ref;
      if (null === a2 && null !== c2 || null !== a2 && a2.ref !== c2) b2.flags |= 512, b2.flags |= 2097152;
    }
    function cj(a2, b2, c2, d2, e2) {
      var f2 = Zf(c2) ? Xf : H2.current;
      f2 = Yf(b2, f2);
      ch(b2, e2);
      c2 = Nh(a2, b2, c2, d2, f2, e2);
      d2 = Sh();
      if (null !== a2 && !dh) return b2.updateQueue = a2.updateQueue, b2.flags &= -2053, a2.lanes &= ~e2, Zi2(a2, b2, e2);
      I2 && d2 && vg(b2);
      b2.flags |= 1;
      Xi2(a2, b2, c2, e2);
      return b2.child;
    }
    function hj(a2, b2, c2, d2, e2) {
      if (Zf(c2)) {
        var f2 = true;
        cg(b2);
      } else f2 = false;
      ch(b2, e2);
      if (null === b2.stateNode) ij(a2, b2), Gi2(b2, c2, d2), Ii2(b2, c2, d2, e2), d2 = true;
      else if (null === a2) {
        var g2 = b2.stateNode, h2 = b2.memoizedProps;
        g2.props = h2;
        var k2 = g2.context, l2 = c2.contextType;
        "object" === typeof l2 && null !== l2 ? l2 = eh(l2) : (l2 = Zf(c2) ? Xf : H2.current, l2 = Yf(b2, l2));
        var m2 = c2.getDerivedStateFromProps, q2 = "function" === typeof m2 || "function" === typeof g2.getSnapshotBeforeUpdate;
        q2 || "function" !== typeof g2.UNSAFE_componentWillReceiveProps && "function" !== typeof g2.componentWillReceiveProps || (h2 !== d2 || k2 !== l2) && Hi2(b2, g2, d2, l2);
        jh = false;
        var r2 = b2.memoizedState;
        g2.state = r2;
        qh(b2, d2, g2, e2);
        k2 = b2.memoizedState;
        h2 !== d2 || r2 !== k2 || Wf.current || jh ? ("function" === typeof m2 && (Di(b2, c2, m2, d2), k2 = b2.memoizedState), (h2 = jh || Fi2(b2, c2, h2, d2, r2, k2, l2)) ? (q2 || "function" !== typeof g2.UNSAFE_componentWillMount && "function" !== typeof g2.componentWillMount || ("function" === typeof g2.componentWillMount && g2.componentWillMount(), "function" === typeof g2.UNSAFE_componentWillMount && g2.UNSAFE_componentWillMount()), "function" === typeof g2.componentDidMount && (b2.flags |= 4194308)) : ("function" === typeof g2.componentDidMount && (b2.flags |= 4194308), b2.memoizedProps = d2, b2.memoizedState = k2), g2.props = d2, g2.state = k2, g2.context = l2, d2 = h2) : ("function" === typeof g2.componentDidMount && (b2.flags |= 4194308), d2 = false);
      } else {
        g2 = b2.stateNode;
        lh(a2, b2);
        h2 = b2.memoizedProps;
        l2 = b2.type === b2.elementType ? h2 : Ci2(b2.type, h2);
        g2.props = l2;
        q2 = b2.pendingProps;
        r2 = g2.context;
        k2 = c2.contextType;
        "object" === typeof k2 && null !== k2 ? k2 = eh(k2) : (k2 = Zf(c2) ? Xf : H2.current, k2 = Yf(b2, k2));
        var y2 = c2.getDerivedStateFromProps;
        (m2 = "function" === typeof y2 || "function" === typeof g2.getSnapshotBeforeUpdate) || "function" !== typeof g2.UNSAFE_componentWillReceiveProps && "function" !== typeof g2.componentWillReceiveProps || (h2 !== q2 || r2 !== k2) && Hi2(b2, g2, d2, k2);
        jh = false;
        r2 = b2.memoizedState;
        g2.state = r2;
        qh(b2, d2, g2, e2);
        var n2 = b2.memoizedState;
        h2 !== q2 || r2 !== n2 || Wf.current || jh ? ("function" === typeof y2 && (Di(b2, c2, y2, d2), n2 = b2.memoizedState), (l2 = jh || Fi2(b2, c2, l2, d2, r2, n2, k2) || false) ? (m2 || "function" !== typeof g2.UNSAFE_componentWillUpdate && "function" !== typeof g2.componentWillUpdate || ("function" === typeof g2.componentWillUpdate && g2.componentWillUpdate(d2, n2, k2), "function" === typeof g2.UNSAFE_componentWillUpdate && g2.UNSAFE_componentWillUpdate(d2, n2, k2)), "function" === typeof g2.componentDidUpdate && (b2.flags |= 4), "function" === typeof g2.getSnapshotBeforeUpdate && (b2.flags |= 1024)) : ("function" !== typeof g2.componentDidUpdate || h2 === a2.memoizedProps && r2 === a2.memoizedState || (b2.flags |= 4), "function" !== typeof g2.getSnapshotBeforeUpdate || h2 === a2.memoizedProps && r2 === a2.memoizedState || (b2.flags |= 1024), b2.memoizedProps = d2, b2.memoizedState = n2), g2.props = d2, g2.state = n2, g2.context = k2, d2 = l2) : ("function" !== typeof g2.componentDidUpdate || h2 === a2.memoizedProps && r2 === a2.memoizedState || (b2.flags |= 4), "function" !== typeof g2.getSnapshotBeforeUpdate || h2 === a2.memoizedProps && r2 === a2.memoizedState || (b2.flags |= 1024), d2 = false);
      }
      return jj(a2, b2, c2, d2, f2, e2);
    }
    function jj(a2, b2, c2, d2, e2, f2) {
      gj(a2, b2);
      var g2 = 0 !== (b2.flags & 128);
      if (!d2 && !g2) return e2 && dg(b2, c2, false), Zi2(a2, b2, f2);
      d2 = b2.stateNode;
      Wi2.current = b2;
      var h2 = g2 && "function" !== typeof c2.getDerivedStateFromError ? null : d2.render();
      b2.flags |= 1;
      null !== a2 && g2 ? (b2.child = Ug(b2, a2.child, null, f2), b2.child = Ug(b2, null, h2, f2)) : Xi2(a2, b2, h2, f2);
      b2.memoizedState = d2.state;
      e2 && dg(b2, c2, true);
      return b2.child;
    }
    function kj(a2) {
      var b2 = a2.stateNode;
      b2.pendingContext ? ag(a2, b2.pendingContext, b2.pendingContext !== b2.context) : b2.context && ag(a2, b2.context, false);
      yh(a2, b2.containerInfo);
    }
    function lj(a2, b2, c2, d2, e2) {
      Ig();
      Jg(e2);
      b2.flags |= 256;
      Xi2(a2, b2, c2, d2);
      return b2.child;
    }
    var mj = { dehydrated: null, treeContext: null, retryLane: 0 };
    function nj(a2) {
      return { baseLanes: a2, cachePool: null, transitions: null };
    }
    function oj(a2, b2, c2) {
      var d2 = b2.pendingProps, e2 = L2.current, f2 = false, g2 = 0 !== (b2.flags & 128), h2;
      (h2 = g2) || (h2 = null !== a2 && null === a2.memoizedState ? false : 0 !== (e2 & 2));
      if (h2) f2 = true, b2.flags &= -129;
      else if (null === a2 || null !== a2.memoizedState) e2 |= 1;
      G2(L2, e2 & 1);
      if (null === a2) {
        Eg(b2);
        a2 = b2.memoizedState;
        if (null !== a2 && (a2 = a2.dehydrated, null !== a2)) return 0 === (b2.mode & 1) ? b2.lanes = 1 : "$!" === a2.data ? b2.lanes = 8 : b2.lanes = 1073741824, null;
        g2 = d2.children;
        a2 = d2.fallback;
        return f2 ? (d2 = b2.mode, f2 = b2.child, g2 = { mode: "hidden", children: g2 }, 0 === (d2 & 1) && null !== f2 ? (f2.childLanes = 0, f2.pendingProps = g2) : f2 = pj(g2, d2, 0, null), a2 = Tg(a2, d2, c2, null), f2.return = b2, a2.return = b2, f2.sibling = a2, b2.child = f2, b2.child.memoizedState = nj(c2), b2.memoizedState = mj, a2) : qj(b2, g2);
      }
      e2 = a2.memoizedState;
      if (null !== e2 && (h2 = e2.dehydrated, null !== h2)) return rj(a2, b2, g2, d2, h2, e2, c2);
      if (f2) {
        f2 = d2.fallback;
        g2 = b2.mode;
        e2 = a2.child;
        h2 = e2.sibling;
        var k2 = { mode: "hidden", children: d2.children };
        0 === (g2 & 1) && b2.child !== e2 ? (d2 = b2.child, d2.childLanes = 0, d2.pendingProps = k2, b2.deletions = null) : (d2 = Pg(e2, k2), d2.subtreeFlags = e2.subtreeFlags & 14680064);
        null !== h2 ? f2 = Pg(h2, f2) : (f2 = Tg(f2, g2, c2, null), f2.flags |= 2);
        f2.return = b2;
        d2.return = b2;
        d2.sibling = f2;
        b2.child = d2;
        d2 = f2;
        f2 = b2.child;
        g2 = a2.child.memoizedState;
        g2 = null === g2 ? nj(c2) : { baseLanes: g2.baseLanes | c2, cachePool: null, transitions: g2.transitions };
        f2.memoizedState = g2;
        f2.childLanes = a2.childLanes & ~c2;
        b2.memoizedState = mj;
        return d2;
      }
      f2 = a2.child;
      a2 = f2.sibling;
      d2 = Pg(f2, { mode: "visible", children: d2.children });
      0 === (b2.mode & 1) && (d2.lanes = c2);
      d2.return = b2;
      d2.sibling = null;
      null !== a2 && (c2 = b2.deletions, null === c2 ? (b2.deletions = [a2], b2.flags |= 16) : c2.push(a2));
      b2.child = d2;
      b2.memoizedState = null;
      return d2;
    }
    function qj(a2, b2) {
      b2 = pj({ mode: "visible", children: b2 }, a2.mode, 0, null);
      b2.return = a2;
      return a2.child = b2;
    }
    function sj(a2, b2, c2, d2) {
      null !== d2 && Jg(d2);
      Ug(b2, a2.child, null, c2);
      a2 = qj(b2, b2.pendingProps.children);
      a2.flags |= 2;
      b2.memoizedState = null;
      return a2;
    }
    function rj(a2, b2, c2, d2, e2, f2, g2) {
      if (c2) {
        if (b2.flags & 256) return b2.flags &= -257, d2 = Ki(Error(p2(422))), sj(a2, b2, g2, d2);
        if (null !== b2.memoizedState) return b2.child = a2.child, b2.flags |= 128, null;
        f2 = d2.fallback;
        e2 = b2.mode;
        d2 = pj({ mode: "visible", children: d2.children }, e2, 0, null);
        f2 = Tg(f2, e2, g2, null);
        f2.flags |= 2;
        d2.return = b2;
        f2.return = b2;
        d2.sibling = f2;
        b2.child = d2;
        0 !== (b2.mode & 1) && Ug(b2, a2.child, null, g2);
        b2.child.memoizedState = nj(g2);
        b2.memoizedState = mj;
        return f2;
      }
      if (0 === (b2.mode & 1)) return sj(a2, b2, g2, null);
      if ("$!" === e2.data) {
        d2 = e2.nextSibling && e2.nextSibling.dataset;
        if (d2) var h2 = d2.dgst;
        d2 = h2;
        f2 = Error(p2(419));
        d2 = Ki(f2, d2, void 0);
        return sj(a2, b2, g2, d2);
      }
      h2 = 0 !== (g2 & a2.childLanes);
      if (dh || h2) {
        d2 = Q2;
        if (null !== d2) {
          switch (g2 & -g2) {
            case 4:
              e2 = 2;
              break;
            case 16:
              e2 = 8;
              break;
            case 64:
            case 128:
            case 256:
            case 512:
            case 1024:
            case 2048:
            case 4096:
            case 8192:
            case 16384:
            case 32768:
            case 65536:
            case 131072:
            case 262144:
            case 524288:
            case 1048576:
            case 2097152:
            case 4194304:
            case 8388608:
            case 16777216:
            case 33554432:
            case 67108864:
              e2 = 32;
              break;
            case 536870912:
              e2 = 268435456;
              break;
            default:
              e2 = 0;
          }
          e2 = 0 !== (e2 & (d2.suspendedLanes | g2)) ? 0 : e2;
          0 !== e2 && e2 !== f2.retryLane && (f2.retryLane = e2, ih(a2, e2), gi2(d2, a2, e2, -1));
        }
        tj();
        d2 = Ki(Error(p2(421)));
        return sj(a2, b2, g2, d2);
      }
      if ("$?" === e2.data) return b2.flags |= 128, b2.child = a2.child, b2 = uj.bind(null, a2), e2._reactRetry = b2, null;
      a2 = f2.treeContext;
      yg = Lf(e2.nextSibling);
      xg = b2;
      I2 = true;
      zg = null;
      null !== a2 && (og[pg++] = rg, og[pg++] = sg, og[pg++] = qg, rg = a2.id, sg = a2.overflow, qg = b2);
      b2 = qj(b2, d2.children);
      b2.flags |= 4096;
      return b2;
    }
    function vj(a2, b2, c2) {
      a2.lanes |= b2;
      var d2 = a2.alternate;
      null !== d2 && (d2.lanes |= b2);
      bh(a2.return, b2, c2);
    }
    function wj(a2, b2, c2, d2, e2) {
      var f2 = a2.memoizedState;
      null === f2 ? a2.memoizedState = { isBackwards: b2, rendering: null, renderingStartTime: 0, last: d2, tail: c2, tailMode: e2 } : (f2.isBackwards = b2, f2.rendering = null, f2.renderingStartTime = 0, f2.last = d2, f2.tail = c2, f2.tailMode = e2);
    }
    function xj(a2, b2, c2) {
      var d2 = b2.pendingProps, e2 = d2.revealOrder, f2 = d2.tail;
      Xi2(a2, b2, d2.children, c2);
      d2 = L2.current;
      if (0 !== (d2 & 2)) d2 = d2 & 1 | 2, b2.flags |= 128;
      else {
        if (null !== a2 && 0 !== (a2.flags & 128)) a: for (a2 = b2.child; null !== a2; ) {
          if (13 === a2.tag) null !== a2.memoizedState && vj(a2, c2, b2);
          else if (19 === a2.tag) vj(a2, c2, b2);
          else if (null !== a2.child) {
            a2.child.return = a2;
            a2 = a2.child;
            continue;
          }
          if (a2 === b2) break a;
          for (; null === a2.sibling; ) {
            if (null === a2.return || a2.return === b2) break a;
            a2 = a2.return;
          }
          a2.sibling.return = a2.return;
          a2 = a2.sibling;
        }
        d2 &= 1;
      }
      G2(L2, d2);
      if (0 === (b2.mode & 1)) b2.memoizedState = null;
      else switch (e2) {
        case "forwards":
          c2 = b2.child;
          for (e2 = null; null !== c2; ) a2 = c2.alternate, null !== a2 && null === Ch(a2) && (e2 = c2), c2 = c2.sibling;
          c2 = e2;
          null === c2 ? (e2 = b2.child, b2.child = null) : (e2 = c2.sibling, c2.sibling = null);
          wj(b2, false, e2, c2, f2);
          break;
        case "backwards":
          c2 = null;
          e2 = b2.child;
          for (b2.child = null; null !== e2; ) {
            a2 = e2.alternate;
            if (null !== a2 && null === Ch(a2)) {
              b2.child = e2;
              break;
            }
            a2 = e2.sibling;
            e2.sibling = c2;
            c2 = e2;
            e2 = a2;
          }
          wj(b2, true, c2, null, f2);
          break;
        case "together":
          wj(b2, false, null, null, void 0);
          break;
        default:
          b2.memoizedState = null;
      }
      return b2.child;
    }
    function ij(a2, b2) {
      0 === (b2.mode & 1) && null !== a2 && (a2.alternate = null, b2.alternate = null, b2.flags |= 2);
    }
    function Zi2(a2, b2, c2) {
      null !== a2 && (b2.dependencies = a2.dependencies);
      rh |= b2.lanes;
      if (0 === (c2 & b2.childLanes)) return null;
      if (null !== a2 && b2.child !== a2.child) throw Error(p2(153));
      if (null !== b2.child) {
        a2 = b2.child;
        c2 = Pg(a2, a2.pendingProps);
        b2.child = c2;
        for (c2.return = b2; null !== a2.sibling; ) a2 = a2.sibling, c2 = c2.sibling = Pg(a2, a2.pendingProps), c2.return = b2;
        c2.sibling = null;
      }
      return b2.child;
    }
    function yj(a2, b2, c2) {
      switch (b2.tag) {
        case 3:
          kj(b2);
          Ig();
          break;
        case 5:
          Ah(b2);
          break;
        case 1:
          Zf(b2.type) && cg(b2);
          break;
        case 4:
          yh(b2, b2.stateNode.containerInfo);
          break;
        case 10:
          var d2 = b2.type._context, e2 = b2.memoizedProps.value;
          G2(Wg, d2._currentValue);
          d2._currentValue = e2;
          break;
        case 13:
          d2 = b2.memoizedState;
          if (null !== d2) {
            if (null !== d2.dehydrated) return G2(L2, L2.current & 1), b2.flags |= 128, null;
            if (0 !== (c2 & b2.child.childLanes)) return oj(a2, b2, c2);
            G2(L2, L2.current & 1);
            a2 = Zi2(a2, b2, c2);
            return null !== a2 ? a2.sibling : null;
          }
          G2(L2, L2.current & 1);
          break;
        case 19:
          d2 = 0 !== (c2 & b2.childLanes);
          if (0 !== (a2.flags & 128)) {
            if (d2) return xj(a2, b2, c2);
            b2.flags |= 128;
          }
          e2 = b2.memoizedState;
          null !== e2 && (e2.rendering = null, e2.tail = null, e2.lastEffect = null);
          G2(L2, L2.current);
          if (d2) break;
          else return null;
        case 22:
        case 23:
          return b2.lanes = 0, dj(a2, b2, c2);
      }
      return Zi2(a2, b2, c2);
    }
    var zj, Aj, Bj, Cj;
    zj = function(a2, b2) {
      for (var c2 = b2.child; null !== c2; ) {
        if (5 === c2.tag || 6 === c2.tag) a2.appendChild(c2.stateNode);
        else if (4 !== c2.tag && null !== c2.child) {
          c2.child.return = c2;
          c2 = c2.child;
          continue;
        }
        if (c2 === b2) break;
        for (; null === c2.sibling; ) {
          if (null === c2.return || c2.return === b2) return;
          c2 = c2.return;
        }
        c2.sibling.return = c2.return;
        c2 = c2.sibling;
      }
    };
    Aj = function() {
    };
    Bj = function(a2, b2, c2, d2) {
      var e2 = a2.memoizedProps;
      if (e2 !== d2) {
        a2 = b2.stateNode;
        xh(uh.current);
        var f2 = null;
        switch (c2) {
          case "input":
            e2 = Ya(a2, e2);
            d2 = Ya(a2, d2);
            f2 = [];
            break;
          case "select":
            e2 = A2({}, e2, { value: void 0 });
            d2 = A2({}, d2, { value: void 0 });
            f2 = [];
            break;
          case "textarea":
            e2 = gb(a2, e2);
            d2 = gb(a2, d2);
            f2 = [];
            break;
          default:
            "function" !== typeof e2.onClick && "function" === typeof d2.onClick && (a2.onclick = Bf);
        }
        ub(c2, d2);
        var g2;
        c2 = null;
        for (l2 in e2) if (!d2.hasOwnProperty(l2) && e2.hasOwnProperty(l2) && null != e2[l2]) if ("style" === l2) {
          var h2 = e2[l2];
          for (g2 in h2) h2.hasOwnProperty(g2) && (c2 || (c2 = {}), c2[g2] = "");
        } else "dangerouslySetInnerHTML" !== l2 && "children" !== l2 && "suppressContentEditableWarning" !== l2 && "suppressHydrationWarning" !== l2 && "autoFocus" !== l2 && (ea.hasOwnProperty(l2) ? f2 || (f2 = []) : (f2 = f2 || []).push(l2, null));
        for (l2 in d2) {
          var k2 = d2[l2];
          h2 = null != e2 ? e2[l2] : void 0;
          if (d2.hasOwnProperty(l2) && k2 !== h2 && (null != k2 || null != h2)) if ("style" === l2) if (h2) {
            for (g2 in h2) !h2.hasOwnProperty(g2) || k2 && k2.hasOwnProperty(g2) || (c2 || (c2 = {}), c2[g2] = "");
            for (g2 in k2) k2.hasOwnProperty(g2) && h2[g2] !== k2[g2] && (c2 || (c2 = {}), c2[g2] = k2[g2]);
          } else c2 || (f2 || (f2 = []), f2.push(
            l2,
            c2
          )), c2 = k2;
          else "dangerouslySetInnerHTML" === l2 ? (k2 = k2 ? k2.__html : void 0, h2 = h2 ? h2.__html : void 0, null != k2 && h2 !== k2 && (f2 = f2 || []).push(l2, k2)) : "children" === l2 ? "string" !== typeof k2 && "number" !== typeof k2 || (f2 = f2 || []).push(l2, "" + k2) : "suppressContentEditableWarning" !== l2 && "suppressHydrationWarning" !== l2 && (ea.hasOwnProperty(l2) ? (null != k2 && "onScroll" === l2 && D2("scroll", a2), f2 || h2 === k2 || (f2 = [])) : (f2 = f2 || []).push(l2, k2));
        }
        c2 && (f2 = f2 || []).push("style", c2);
        var l2 = f2;
        if (b2.updateQueue = l2) b2.flags |= 4;
      }
    };
    Cj = function(a2, b2, c2, d2) {
      c2 !== d2 && (b2.flags |= 4);
    };
    function Dj(a2, b2) {
      if (!I2) switch (a2.tailMode) {
        case "hidden":
          b2 = a2.tail;
          for (var c2 = null; null !== b2; ) null !== b2.alternate && (c2 = b2), b2 = b2.sibling;
          null === c2 ? a2.tail = null : c2.sibling = null;
          break;
        case "collapsed":
          c2 = a2.tail;
          for (var d2 = null; null !== c2; ) null !== c2.alternate && (d2 = c2), c2 = c2.sibling;
          null === d2 ? b2 || null === a2.tail ? a2.tail = null : a2.tail.sibling = null : d2.sibling = null;
      }
    }
    function S2(a2) {
      var b2 = null !== a2.alternate && a2.alternate.child === a2.child, c2 = 0, d2 = 0;
      if (b2) for (var e2 = a2.child; null !== e2; ) c2 |= e2.lanes | e2.childLanes, d2 |= e2.subtreeFlags & 14680064, d2 |= e2.flags & 14680064, e2.return = a2, e2 = e2.sibling;
      else for (e2 = a2.child; null !== e2; ) c2 |= e2.lanes | e2.childLanes, d2 |= e2.subtreeFlags, d2 |= e2.flags, e2.return = a2, e2 = e2.sibling;
      a2.subtreeFlags |= d2;
      a2.childLanes = c2;
      return b2;
    }
    function Ej(a2, b2, c2) {
      var d2 = b2.pendingProps;
      wg(b2);
      switch (b2.tag) {
        case 2:
        case 16:
        case 15:
        case 0:
        case 11:
        case 7:
        case 8:
        case 12:
        case 9:
        case 14:
          return S2(b2), null;
        case 1:
          return Zf(b2.type) && $f(), S2(b2), null;
        case 3:
          d2 = b2.stateNode;
          zh();
          E2(Wf);
          E2(H2);
          Eh();
          d2.pendingContext && (d2.context = d2.pendingContext, d2.pendingContext = null);
          if (null === a2 || null === a2.child) Gg(b2) ? b2.flags |= 4 : null === a2 || a2.memoizedState.isDehydrated && 0 === (b2.flags & 256) || (b2.flags |= 1024, null !== zg && (Fj(zg), zg = null));
          Aj(a2, b2);
          S2(b2);
          return null;
        case 5:
          Bh(b2);
          var e2 = xh(wh.current);
          c2 = b2.type;
          if (null !== a2 && null != b2.stateNode) Bj(a2, b2, c2, d2, e2), a2.ref !== b2.ref && (b2.flags |= 512, b2.flags |= 2097152);
          else {
            if (!d2) {
              if (null === b2.stateNode) throw Error(p2(166));
              S2(b2);
              return null;
            }
            a2 = xh(uh.current);
            if (Gg(b2)) {
              d2 = b2.stateNode;
              c2 = b2.type;
              var f2 = b2.memoizedProps;
              d2[Of] = b2;
              d2[Pf] = f2;
              a2 = 0 !== (b2.mode & 1);
              switch (c2) {
                case "dialog":
                  D2("cancel", d2);
                  D2("close", d2);
                  break;
                case "iframe":
                case "object":
                case "embed":
                  D2("load", d2);
                  break;
                case "video":
                case "audio":
                  for (e2 = 0; e2 < lf.length; e2++) D2(lf[e2], d2);
                  break;
                case "source":
                  D2("error", d2);
                  break;
                case "img":
                case "image":
                case "link":
                  D2(
                    "error",
                    d2
                  );
                  D2("load", d2);
                  break;
                case "details":
                  D2("toggle", d2);
                  break;
                case "input":
                  Za(d2, f2);
                  D2("invalid", d2);
                  break;
                case "select":
                  d2._wrapperState = { wasMultiple: !!f2.multiple };
                  D2("invalid", d2);
                  break;
                case "textarea":
                  hb(d2, f2), D2("invalid", d2);
              }
              ub(c2, f2);
              e2 = null;
              for (var g2 in f2) if (f2.hasOwnProperty(g2)) {
                var h2 = f2[g2];
                "children" === g2 ? "string" === typeof h2 ? d2.textContent !== h2 && (true !== f2.suppressHydrationWarning && Af(d2.textContent, h2, a2), e2 = ["children", h2]) : "number" === typeof h2 && d2.textContent !== "" + h2 && (true !== f2.suppressHydrationWarning && Af(
                  d2.textContent,
                  h2,
                  a2
                ), e2 = ["children", "" + h2]) : ea.hasOwnProperty(g2) && null != h2 && "onScroll" === g2 && D2("scroll", d2);
              }
              switch (c2) {
                case "input":
                  Va(d2);
                  db(d2, f2, true);
                  break;
                case "textarea":
                  Va(d2);
                  jb(d2);
                  break;
                case "select":
                case "option":
                  break;
                default:
                  "function" === typeof f2.onClick && (d2.onclick = Bf);
              }
              d2 = e2;
              b2.updateQueue = d2;
              null !== d2 && (b2.flags |= 4);
            } else {
              g2 = 9 === e2.nodeType ? e2 : e2.ownerDocument;
              "http://www.w3.org/1999/xhtml" === a2 && (a2 = kb(c2));
              "http://www.w3.org/1999/xhtml" === a2 ? "script" === c2 ? (a2 = g2.createElement("div"), a2.innerHTML = "<script><\/script>", a2 = a2.removeChild(a2.firstChild)) : "string" === typeof d2.is ? a2 = g2.createElement(c2, { is: d2.is }) : (a2 = g2.createElement(c2), "select" === c2 && (g2 = a2, d2.multiple ? g2.multiple = true : d2.size && (g2.size = d2.size))) : a2 = g2.createElementNS(a2, c2);
              a2[Of] = b2;
              a2[Pf] = d2;
              zj(a2, b2, false, false);
              b2.stateNode = a2;
              a: {
                g2 = vb(c2, d2);
                switch (c2) {
                  case "dialog":
                    D2("cancel", a2);
                    D2("close", a2);
                    e2 = d2;
                    break;
                  case "iframe":
                  case "object":
                  case "embed":
                    D2("load", a2);
                    e2 = d2;
                    break;
                  case "video":
                  case "audio":
                    for (e2 = 0; e2 < lf.length; e2++) D2(lf[e2], a2);
                    e2 = d2;
                    break;
                  case "source":
                    D2("error", a2);
                    e2 = d2;
                    break;
                  case "img":
                  case "image":
                  case "link":
                    D2(
                      "error",
                      a2
                    );
                    D2("load", a2);
                    e2 = d2;
                    break;
                  case "details":
                    D2("toggle", a2);
                    e2 = d2;
                    break;
                  case "input":
                    Za(a2, d2);
                    e2 = Ya(a2, d2);
                    D2("invalid", a2);
                    break;
                  case "option":
                    e2 = d2;
                    break;
                  case "select":
                    a2._wrapperState = { wasMultiple: !!d2.multiple };
                    e2 = A2({}, d2, { value: void 0 });
                    D2("invalid", a2);
                    break;
                  case "textarea":
                    hb(a2, d2);
                    e2 = gb(a2, d2);
                    D2("invalid", a2);
                    break;
                  default:
                    e2 = d2;
                }
                ub(c2, e2);
                h2 = e2;
                for (f2 in h2) if (h2.hasOwnProperty(f2)) {
                  var k2 = h2[f2];
                  "style" === f2 ? sb(a2, k2) : "dangerouslySetInnerHTML" === f2 ? (k2 = k2 ? k2.__html : void 0, null != k2 && nb(a2, k2)) : "children" === f2 ? "string" === typeof k2 ? ("textarea" !== c2 || "" !== k2) && ob(a2, k2) : "number" === typeof k2 && ob(a2, "" + k2) : "suppressContentEditableWarning" !== f2 && "suppressHydrationWarning" !== f2 && "autoFocus" !== f2 && (ea.hasOwnProperty(f2) ? null != k2 && "onScroll" === f2 && D2("scroll", a2) : null != k2 && ta(a2, f2, k2, g2));
                }
                switch (c2) {
                  case "input":
                    Va(a2);
                    db(a2, d2, false);
                    break;
                  case "textarea":
                    Va(a2);
                    jb(a2);
                    break;
                  case "option":
                    null != d2.value && a2.setAttribute("value", "" + Sa(d2.value));
                    break;
                  case "select":
                    a2.multiple = !!d2.multiple;
                    f2 = d2.value;
                    null != f2 ? fb(a2, !!d2.multiple, f2, false) : null != d2.defaultValue && fb(
                      a2,
                      !!d2.multiple,
                      d2.defaultValue,
                      true
                    );
                    break;
                  default:
                    "function" === typeof e2.onClick && (a2.onclick = Bf);
                }
                switch (c2) {
                  case "button":
                  case "input":
                  case "select":
                  case "textarea":
                    d2 = !!d2.autoFocus;
                    break a;
                  case "img":
                    d2 = true;
                    break a;
                  default:
                    d2 = false;
                }
              }
              d2 && (b2.flags |= 4);
            }
            null !== b2.ref && (b2.flags |= 512, b2.flags |= 2097152);
          }
          S2(b2);
          return null;
        case 6:
          if (a2 && null != b2.stateNode) Cj(a2, b2, a2.memoizedProps, d2);
          else {
            if ("string" !== typeof d2 && null === b2.stateNode) throw Error(p2(166));
            c2 = xh(wh.current);
            xh(uh.current);
            if (Gg(b2)) {
              d2 = b2.stateNode;
              c2 = b2.memoizedProps;
              d2[Of] = b2;
              if (f2 = d2.nodeValue !== c2) {
                if (a2 = xg, null !== a2) switch (a2.tag) {
                  case 3:
                    Af(d2.nodeValue, c2, 0 !== (a2.mode & 1));
                    break;
                  case 5:
                    true !== a2.memoizedProps.suppressHydrationWarning && Af(d2.nodeValue, c2, 0 !== (a2.mode & 1));
                }
              }
              f2 && (b2.flags |= 4);
            } else d2 = (9 === c2.nodeType ? c2 : c2.ownerDocument).createTextNode(d2), d2[Of] = b2, b2.stateNode = d2;
          }
          S2(b2);
          return null;
        case 13:
          E2(L2);
          d2 = b2.memoizedState;
          if (null === a2 || null !== a2.memoizedState && null !== a2.memoizedState.dehydrated) {
            if (I2 && null !== yg && 0 !== (b2.mode & 1) && 0 === (b2.flags & 128)) Hg(), Ig(), b2.flags |= 98560, f2 = false;
            else if (f2 = Gg(b2), null !== d2 && null !== d2.dehydrated) {
              if (null === a2) {
                if (!f2) throw Error(p2(318));
                f2 = b2.memoizedState;
                f2 = null !== f2 ? f2.dehydrated : null;
                if (!f2) throw Error(p2(317));
                f2[Of] = b2;
              } else Ig(), 0 === (b2.flags & 128) && (b2.memoizedState = null), b2.flags |= 4;
              S2(b2);
              f2 = false;
            } else null !== zg && (Fj(zg), zg = null), f2 = true;
            if (!f2) return b2.flags & 65536 ? b2 : null;
          }
          if (0 !== (b2.flags & 128)) return b2.lanes = c2, b2;
          d2 = null !== d2;
          d2 !== (null !== a2 && null !== a2.memoizedState) && d2 && (b2.child.flags |= 8192, 0 !== (b2.mode & 1) && (null === a2 || 0 !== (L2.current & 1) ? 0 === T2 && (T2 = 3) : tj()));
          null !== b2.updateQueue && (b2.flags |= 4);
          S2(b2);
          return null;
        case 4:
          return zh(), Aj(a2, b2), null === a2 && sf(b2.stateNode.containerInfo), S2(b2), null;
        case 10:
          return ah(b2.type._context), S2(b2), null;
        case 17:
          return Zf(b2.type) && $f(), S2(b2), null;
        case 19:
          E2(L2);
          f2 = b2.memoizedState;
          if (null === f2) return S2(b2), null;
          d2 = 0 !== (b2.flags & 128);
          g2 = f2.rendering;
          if (null === g2) if (d2) Dj(f2, false);
          else {
            if (0 !== T2 || null !== a2 && 0 !== (a2.flags & 128)) for (a2 = b2.child; null !== a2; ) {
              g2 = Ch(a2);
              if (null !== g2) {
                b2.flags |= 128;
                Dj(f2, false);
                d2 = g2.updateQueue;
                null !== d2 && (b2.updateQueue = d2, b2.flags |= 4);
                b2.subtreeFlags = 0;
                d2 = c2;
                for (c2 = b2.child; null !== c2; ) f2 = c2, a2 = d2, f2.flags &= 14680066, g2 = f2.alternate, null === g2 ? (f2.childLanes = 0, f2.lanes = a2, f2.child = null, f2.subtreeFlags = 0, f2.memoizedProps = null, f2.memoizedState = null, f2.updateQueue = null, f2.dependencies = null, f2.stateNode = null) : (f2.childLanes = g2.childLanes, f2.lanes = g2.lanes, f2.child = g2.child, f2.subtreeFlags = 0, f2.deletions = null, f2.memoizedProps = g2.memoizedProps, f2.memoizedState = g2.memoizedState, f2.updateQueue = g2.updateQueue, f2.type = g2.type, a2 = g2.dependencies, f2.dependencies = null === a2 ? null : { lanes: a2.lanes, firstContext: a2.firstContext }), c2 = c2.sibling;
                G2(L2, L2.current & 1 | 2);
                return b2.child;
              }
              a2 = a2.sibling;
            }
            null !== f2.tail && B2() > Gj && (b2.flags |= 128, d2 = true, Dj(f2, false), b2.lanes = 4194304);
          }
          else {
            if (!d2) if (a2 = Ch(g2), null !== a2) {
              if (b2.flags |= 128, d2 = true, c2 = a2.updateQueue, null !== c2 && (b2.updateQueue = c2, b2.flags |= 4), Dj(f2, true), null === f2.tail && "hidden" === f2.tailMode && !g2.alternate && !I2) return S2(b2), null;
            } else 2 * B2() - f2.renderingStartTime > Gj && 1073741824 !== c2 && (b2.flags |= 128, d2 = true, Dj(f2, false), b2.lanes = 4194304);
            f2.isBackwards ? (g2.sibling = b2.child, b2.child = g2) : (c2 = f2.last, null !== c2 ? c2.sibling = g2 : b2.child = g2, f2.last = g2);
          }
          if (null !== f2.tail) return b2 = f2.tail, f2.rendering = b2, f2.tail = b2.sibling, f2.renderingStartTime = B2(), b2.sibling = null, c2 = L2.current, G2(L2, d2 ? c2 & 1 | 2 : c2 & 1), b2;
          S2(b2);
          return null;
        case 22:
        case 23:
          return Hj(), d2 = null !== b2.memoizedState, null !== a2 && null !== a2.memoizedState !== d2 && (b2.flags |= 8192), d2 && 0 !== (b2.mode & 1) ? 0 !== (fj & 1073741824) && (S2(b2), b2.subtreeFlags & 6 && (b2.flags |= 8192)) : S2(b2), null;
        case 24:
          return null;
        case 25:
          return null;
      }
      throw Error(p2(156, b2.tag));
    }
    function Ij(a2, b2) {
      wg(b2);
      switch (b2.tag) {
        case 1:
          return Zf(b2.type) && $f(), a2 = b2.flags, a2 & 65536 ? (b2.flags = a2 & -65537 | 128, b2) : null;
        case 3:
          return zh(), E2(Wf), E2(H2), Eh(), a2 = b2.flags, 0 !== (a2 & 65536) && 0 === (a2 & 128) ? (b2.flags = a2 & -65537 | 128, b2) : null;
        case 5:
          return Bh(b2), null;
        case 13:
          E2(L2);
          a2 = b2.memoizedState;
          if (null !== a2 && null !== a2.dehydrated) {
            if (null === b2.alternate) throw Error(p2(340));
            Ig();
          }
          a2 = b2.flags;
          return a2 & 65536 ? (b2.flags = a2 & -65537 | 128, b2) : null;
        case 19:
          return E2(L2), null;
        case 4:
          return zh(), null;
        case 10:
          return ah(b2.type._context), null;
        case 22:
        case 23:
          return Hj(), null;
        case 24:
          return null;
        default:
          return null;
      }
    }
    var Jj = false, U2 = false, Kj = "function" === typeof WeakSet ? WeakSet : Set, V2 = null;
    function Lj(a2, b2) {
      var c2 = a2.ref;
      if (null !== c2) if ("function" === typeof c2) try {
        c2(null);
      } catch (d2) {
        W2(a2, b2, d2);
      }
      else c2.current = null;
    }
    function Mj(a2, b2, c2) {
      try {
        c2();
      } catch (d2) {
        W2(a2, b2, d2);
      }
    }
    var Nj = false;
    function Oj(a2, b2) {
      Cf = dd;
      a2 = Me2();
      if (Ne2(a2)) {
        if ("selectionStart" in a2) var c2 = { start: a2.selectionStart, end: a2.selectionEnd };
        else a: {
          c2 = (c2 = a2.ownerDocument) && c2.defaultView || window;
          var d2 = c2.getSelection && c2.getSelection();
          if (d2 && 0 !== d2.rangeCount) {
            c2 = d2.anchorNode;
            var e2 = d2.anchorOffset, f2 = d2.focusNode;
            d2 = d2.focusOffset;
            try {
              c2.nodeType, f2.nodeType;
            } catch (F2) {
              c2 = null;
              break a;
            }
            var g2 = 0, h2 = -1, k2 = -1, l2 = 0, m2 = 0, q2 = a2, r2 = null;
            b: for (; ; ) {
              for (var y2; ; ) {
                q2 !== c2 || 0 !== e2 && 3 !== q2.nodeType || (h2 = g2 + e2);
                q2 !== f2 || 0 !== d2 && 3 !== q2.nodeType || (k2 = g2 + d2);
                3 === q2.nodeType && (g2 += q2.nodeValue.length);
                if (null === (y2 = q2.firstChild)) break;
                r2 = q2;
                q2 = y2;
              }
              for (; ; ) {
                if (q2 === a2) break b;
                r2 === c2 && ++l2 === e2 && (h2 = g2);
                r2 === f2 && ++m2 === d2 && (k2 = g2);
                if (null !== (y2 = q2.nextSibling)) break;
                q2 = r2;
                r2 = q2.parentNode;
              }
              q2 = y2;
            }
            c2 = -1 === h2 || -1 === k2 ? null : { start: h2, end: k2 };
          } else c2 = null;
        }
        c2 = c2 || { start: 0, end: 0 };
      } else c2 = null;
      Df = { focusedElem: a2, selectionRange: c2 };
      dd = false;
      for (V2 = b2; null !== V2; ) if (b2 = V2, a2 = b2.child, 0 !== (b2.subtreeFlags & 1028) && null !== a2) a2.return = b2, V2 = a2;
      else for (; null !== V2; ) {
        b2 = V2;
        try {
          var n2 = b2.alternate;
          if (0 !== (b2.flags & 1024)) switch (b2.tag) {
            case 0:
            case 11:
            case 15:
              break;
            case 1:
              if (null !== n2) {
                var t2 = n2.memoizedProps, J2 = n2.memoizedState, x2 = b2.stateNode, w2 = x2.getSnapshotBeforeUpdate(b2.elementType === b2.type ? t2 : Ci2(b2.type, t2), J2);
                x2.__reactInternalSnapshotBeforeUpdate = w2;
              }
              break;
            case 3:
              var u2 = b2.stateNode.containerInfo;
              1 === u2.nodeType ? u2.textContent = "" : 9 === u2.nodeType && u2.documentElement && u2.removeChild(u2.documentElement);
              break;
            case 5:
            case 6:
            case 4:
            case 17:
              break;
            default:
              throw Error(p2(163));
          }
        } catch (F2) {
          W2(b2, b2.return, F2);
        }
        a2 = b2.sibling;
        if (null !== a2) {
          a2.return = b2.return;
          V2 = a2;
          break;
        }
        V2 = b2.return;
      }
      n2 = Nj;
      Nj = false;
      return n2;
    }
    function Pj(a2, b2, c2) {
      var d2 = b2.updateQueue;
      d2 = null !== d2 ? d2.lastEffect : null;
      if (null !== d2) {
        var e2 = d2 = d2.next;
        do {
          if ((e2.tag & a2) === a2) {
            var f2 = e2.destroy;
            e2.destroy = void 0;
            void 0 !== f2 && Mj(b2, c2, f2);
          }
          e2 = e2.next;
        } while (e2 !== d2);
      }
    }
    function Qj(a2, b2) {
      b2 = b2.updateQueue;
      b2 = null !== b2 ? b2.lastEffect : null;
      if (null !== b2) {
        var c2 = b2 = b2.next;
        do {
          if ((c2.tag & a2) === a2) {
            var d2 = c2.create;
            c2.destroy = d2();
          }
          c2 = c2.next;
        } while (c2 !== b2);
      }
    }
    function Rj(a2) {
      var b2 = a2.ref;
      if (null !== b2) {
        var c2 = a2.stateNode;
        switch (a2.tag) {
          case 5:
            a2 = c2;
            break;
          default:
            a2 = c2;
        }
        "function" === typeof b2 ? b2(a2) : b2.current = a2;
      }
    }
    function Sj(a2) {
      var b2 = a2.alternate;
      null !== b2 && (a2.alternate = null, Sj(b2));
      a2.child = null;
      a2.deletions = null;
      a2.sibling = null;
      5 === a2.tag && (b2 = a2.stateNode, null !== b2 && (delete b2[Of], delete b2[Pf], delete b2[of], delete b2[Qf], delete b2[Rf]));
      a2.stateNode = null;
      a2.return = null;
      a2.dependencies = null;
      a2.memoizedProps = null;
      a2.memoizedState = null;
      a2.pendingProps = null;
      a2.stateNode = null;
      a2.updateQueue = null;
    }
    function Tj(a2) {
      return 5 === a2.tag || 3 === a2.tag || 4 === a2.tag;
    }
    function Uj(a2) {
      a: for (; ; ) {
        for (; null === a2.sibling; ) {
          if (null === a2.return || Tj(a2.return)) return null;
          a2 = a2.return;
        }
        a2.sibling.return = a2.return;
        for (a2 = a2.sibling; 5 !== a2.tag && 6 !== a2.tag && 18 !== a2.tag; ) {
          if (a2.flags & 2) continue a;
          if (null === a2.child || 4 === a2.tag) continue a;
          else a2.child.return = a2, a2 = a2.child;
        }
        if (!(a2.flags & 2)) return a2.stateNode;
      }
    }
    function Vj(a2, b2, c2) {
      var d2 = a2.tag;
      if (5 === d2 || 6 === d2) a2 = a2.stateNode, b2 ? 8 === c2.nodeType ? c2.parentNode.insertBefore(a2, b2) : c2.insertBefore(a2, b2) : (8 === c2.nodeType ? (b2 = c2.parentNode, b2.insertBefore(a2, c2)) : (b2 = c2, b2.appendChild(a2)), c2 = c2._reactRootContainer, null !== c2 && void 0 !== c2 || null !== b2.onclick || (b2.onclick = Bf));
      else if (4 !== d2 && (a2 = a2.child, null !== a2)) for (Vj(a2, b2, c2), a2 = a2.sibling; null !== a2; ) Vj(a2, b2, c2), a2 = a2.sibling;
    }
    function Wj(a2, b2, c2) {
      var d2 = a2.tag;
      if (5 === d2 || 6 === d2) a2 = a2.stateNode, b2 ? c2.insertBefore(a2, b2) : c2.appendChild(a2);
      else if (4 !== d2 && (a2 = a2.child, null !== a2)) for (Wj(a2, b2, c2), a2 = a2.sibling; null !== a2; ) Wj(a2, b2, c2), a2 = a2.sibling;
    }
    var X2 = null, Xj = false;
    function Yj(a2, b2, c2) {
      for (c2 = c2.child; null !== c2; ) Zj(a2, b2, c2), c2 = c2.sibling;
    }
    function Zj(a2, b2, c2) {
      if (lc && "function" === typeof lc.onCommitFiberUnmount) try {
        lc.onCommitFiberUnmount(kc, c2);
      } catch (h2) {
      }
      switch (c2.tag) {
        case 5:
          U2 || Lj(c2, b2);
        case 6:
          var d2 = X2, e2 = Xj;
          X2 = null;
          Yj(a2, b2, c2);
          X2 = d2;
          Xj = e2;
          null !== X2 && (Xj ? (a2 = X2, c2 = c2.stateNode, 8 === a2.nodeType ? a2.parentNode.removeChild(c2) : a2.removeChild(c2)) : X2.removeChild(c2.stateNode));
          break;
        case 18:
          null !== X2 && (Xj ? (a2 = X2, c2 = c2.stateNode, 8 === a2.nodeType ? Kf(a2.parentNode, c2) : 1 === a2.nodeType && Kf(a2, c2), bd(a2)) : Kf(X2, c2.stateNode));
          break;
        case 4:
          d2 = X2;
          e2 = Xj;
          X2 = c2.stateNode.containerInfo;
          Xj = true;
          Yj(a2, b2, c2);
          X2 = d2;
          Xj = e2;
          break;
        case 0:
        case 11:
        case 14:
        case 15:
          if (!U2 && (d2 = c2.updateQueue, null !== d2 && (d2 = d2.lastEffect, null !== d2))) {
            e2 = d2 = d2.next;
            do {
              var f2 = e2, g2 = f2.destroy;
              f2 = f2.tag;
              void 0 !== g2 && (0 !== (f2 & 2) ? Mj(c2, b2, g2) : 0 !== (f2 & 4) && Mj(c2, b2, g2));
              e2 = e2.next;
            } while (e2 !== d2);
          }
          Yj(a2, b2, c2);
          break;
        case 1:
          if (!U2 && (Lj(c2, b2), d2 = c2.stateNode, "function" === typeof d2.componentWillUnmount)) try {
            d2.props = c2.memoizedProps, d2.state = c2.memoizedState, d2.componentWillUnmount();
          } catch (h2) {
            W2(c2, b2, h2);
          }
          Yj(a2, b2, c2);
          break;
        case 21:
          Yj(a2, b2, c2);
          break;
        case 22:
          c2.mode & 1 ? (U2 = (d2 = U2) || null !== c2.memoizedState, Yj(a2, b2, c2), U2 = d2) : Yj(a2, b2, c2);
          break;
        default:
          Yj(a2, b2, c2);
      }
    }
    function ak(a2) {
      var b2 = a2.updateQueue;
      if (null !== b2) {
        a2.updateQueue = null;
        var c2 = a2.stateNode;
        null === c2 && (c2 = a2.stateNode = new Kj());
        b2.forEach(function(b3) {
          var d2 = bk.bind(null, a2, b3);
          c2.has(b3) || (c2.add(b3), b3.then(d2, d2));
        });
      }
    }
    function ck(a2, b2) {
      var c2 = b2.deletions;
      if (null !== c2) for (var d2 = 0; d2 < c2.length; d2++) {
        var e2 = c2[d2];
        try {
          var f2 = a2, g2 = b2, h2 = g2;
          a: for (; null !== h2; ) {
            switch (h2.tag) {
              case 5:
                X2 = h2.stateNode;
                Xj = false;
                break a;
              case 3:
                X2 = h2.stateNode.containerInfo;
                Xj = true;
                break a;
              case 4:
                X2 = h2.stateNode.containerInfo;
                Xj = true;
                break a;
            }
            h2 = h2.return;
          }
          if (null === X2) throw Error(p2(160));
          Zj(f2, g2, e2);
          X2 = null;
          Xj = false;
          var k2 = e2.alternate;
          null !== k2 && (k2.return = null);
          e2.return = null;
        } catch (l2) {
          W2(e2, b2, l2);
        }
      }
      if (b2.subtreeFlags & 12854) for (b2 = b2.child; null !== b2; ) dk(b2, a2), b2 = b2.sibling;
    }
    function dk(a2, b2) {
      var c2 = a2.alternate, d2 = a2.flags;
      switch (a2.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          ck(b2, a2);
          ek(a2);
          if (d2 & 4) {
            try {
              Pj(3, a2, a2.return), Qj(3, a2);
            } catch (t2) {
              W2(a2, a2.return, t2);
            }
            try {
              Pj(5, a2, a2.return);
            } catch (t2) {
              W2(a2, a2.return, t2);
            }
          }
          break;
        case 1:
          ck(b2, a2);
          ek(a2);
          d2 & 512 && null !== c2 && Lj(c2, c2.return);
          break;
        case 5:
          ck(b2, a2);
          ek(a2);
          d2 & 512 && null !== c2 && Lj(c2, c2.return);
          if (a2.flags & 32) {
            var e2 = a2.stateNode;
            try {
              ob(e2, "");
            } catch (t2) {
              W2(a2, a2.return, t2);
            }
          }
          if (d2 & 4 && (e2 = a2.stateNode, null != e2)) {
            var f2 = a2.memoizedProps, g2 = null !== c2 ? c2.memoizedProps : f2, h2 = a2.type, k2 = a2.updateQueue;
            a2.updateQueue = null;
            if (null !== k2) try {
              "input" === h2 && "radio" === f2.type && null != f2.name && ab(e2, f2);
              vb(h2, g2);
              var l2 = vb(h2, f2);
              for (g2 = 0; g2 < k2.length; g2 += 2) {
                var m2 = k2[g2], q2 = k2[g2 + 1];
                "style" === m2 ? sb(e2, q2) : "dangerouslySetInnerHTML" === m2 ? nb(e2, q2) : "children" === m2 ? ob(e2, q2) : ta(e2, m2, q2, l2);
              }
              switch (h2) {
                case "input":
                  bb(e2, f2);
                  break;
                case "textarea":
                  ib(e2, f2);
                  break;
                case "select":
                  var r2 = e2._wrapperState.wasMultiple;
                  e2._wrapperState.wasMultiple = !!f2.multiple;
                  var y2 = f2.value;
                  null != y2 ? fb(e2, !!f2.multiple, y2, false) : r2 !== !!f2.multiple && (null != f2.defaultValue ? fb(
                    e2,
                    !!f2.multiple,
                    f2.defaultValue,
                    true
                  ) : fb(e2, !!f2.multiple, f2.multiple ? [] : "", false));
              }
              e2[Pf] = f2;
            } catch (t2) {
              W2(a2, a2.return, t2);
            }
          }
          break;
        case 6:
          ck(b2, a2);
          ek(a2);
          if (d2 & 4) {
            if (null === a2.stateNode) throw Error(p2(162));
            e2 = a2.stateNode;
            f2 = a2.memoizedProps;
            try {
              e2.nodeValue = f2;
            } catch (t2) {
              W2(a2, a2.return, t2);
            }
          }
          break;
        case 3:
          ck(b2, a2);
          ek(a2);
          if (d2 & 4 && null !== c2 && c2.memoizedState.isDehydrated) try {
            bd(b2.containerInfo);
          } catch (t2) {
            W2(a2, a2.return, t2);
          }
          break;
        case 4:
          ck(b2, a2);
          ek(a2);
          break;
        case 13:
          ck(b2, a2);
          ek(a2);
          e2 = a2.child;
          e2.flags & 8192 && (f2 = null !== e2.memoizedState, e2.stateNode.isHidden = f2, !f2 || null !== e2.alternate && null !== e2.alternate.memoizedState || (fk = B2()));
          d2 & 4 && ak(a2);
          break;
        case 22:
          m2 = null !== c2 && null !== c2.memoizedState;
          a2.mode & 1 ? (U2 = (l2 = U2) || m2, ck(b2, a2), U2 = l2) : ck(b2, a2);
          ek(a2);
          if (d2 & 8192) {
            l2 = null !== a2.memoizedState;
            if ((a2.stateNode.isHidden = l2) && !m2 && 0 !== (a2.mode & 1)) for (V2 = a2, m2 = a2.child; null !== m2; ) {
              for (q2 = V2 = m2; null !== V2; ) {
                r2 = V2;
                y2 = r2.child;
                switch (r2.tag) {
                  case 0:
                  case 11:
                  case 14:
                  case 15:
                    Pj(4, r2, r2.return);
                    break;
                  case 1:
                    Lj(r2, r2.return);
                    var n2 = r2.stateNode;
                    if ("function" === typeof n2.componentWillUnmount) {
                      d2 = r2;
                      c2 = r2.return;
                      try {
                        b2 = d2, n2.props = b2.memoizedProps, n2.state = b2.memoizedState, n2.componentWillUnmount();
                      } catch (t2) {
                        W2(d2, c2, t2);
                      }
                    }
                    break;
                  case 5:
                    Lj(r2, r2.return);
                    break;
                  case 22:
                    if (null !== r2.memoizedState) {
                      gk(q2);
                      continue;
                    }
                }
                null !== y2 ? (y2.return = r2, V2 = y2) : gk(q2);
              }
              m2 = m2.sibling;
            }
            a: for (m2 = null, q2 = a2; ; ) {
              if (5 === q2.tag) {
                if (null === m2) {
                  m2 = q2;
                  try {
                    e2 = q2.stateNode, l2 ? (f2 = e2.style, "function" === typeof f2.setProperty ? f2.setProperty("display", "none", "important") : f2.display = "none") : (h2 = q2.stateNode, k2 = q2.memoizedProps.style, g2 = void 0 !== k2 && null !== k2 && k2.hasOwnProperty("display") ? k2.display : null, h2.style.display = rb("display", g2));
                  } catch (t2) {
                    W2(a2, a2.return, t2);
                  }
                }
              } else if (6 === q2.tag) {
                if (null === m2) try {
                  q2.stateNode.nodeValue = l2 ? "" : q2.memoizedProps;
                } catch (t2) {
                  W2(a2, a2.return, t2);
                }
              } else if ((22 !== q2.tag && 23 !== q2.tag || null === q2.memoizedState || q2 === a2) && null !== q2.child) {
                q2.child.return = q2;
                q2 = q2.child;
                continue;
              }
              if (q2 === a2) break a;
              for (; null === q2.sibling; ) {
                if (null === q2.return || q2.return === a2) break a;
                m2 === q2 && (m2 = null);
                q2 = q2.return;
              }
              m2 === q2 && (m2 = null);
              q2.sibling.return = q2.return;
              q2 = q2.sibling;
            }
          }
          break;
        case 19:
          ck(b2, a2);
          ek(a2);
          d2 & 4 && ak(a2);
          break;
        case 21:
          break;
        default:
          ck(
            b2,
            a2
          ), ek(a2);
      }
    }
    function ek(a2) {
      var b2 = a2.flags;
      if (b2 & 2) {
        try {
          a: {
            for (var c2 = a2.return; null !== c2; ) {
              if (Tj(c2)) {
                var d2 = c2;
                break a;
              }
              c2 = c2.return;
            }
            throw Error(p2(160));
          }
          switch (d2.tag) {
            case 5:
              var e2 = d2.stateNode;
              d2.flags & 32 && (ob(e2, ""), d2.flags &= -33);
              var f2 = Uj(a2);
              Wj(a2, f2, e2);
              break;
            case 3:
            case 4:
              var g2 = d2.stateNode.containerInfo, h2 = Uj(a2);
              Vj(a2, h2, g2);
              break;
            default:
              throw Error(p2(161));
          }
        } catch (k2) {
          W2(a2, a2.return, k2);
        }
        a2.flags &= -3;
      }
      b2 & 4096 && (a2.flags &= -4097);
    }
    function hk(a2, b2, c2) {
      V2 = a2;
      ik(a2);
    }
    function ik(a2, b2, c2) {
      for (var d2 = 0 !== (a2.mode & 1); null !== V2; ) {
        var e2 = V2, f2 = e2.child;
        if (22 === e2.tag && d2) {
          var g2 = null !== e2.memoizedState || Jj;
          if (!g2) {
            var h2 = e2.alternate, k2 = null !== h2 && null !== h2.memoizedState || U2;
            h2 = Jj;
            var l2 = U2;
            Jj = g2;
            if ((U2 = k2) && !l2) for (V2 = e2; null !== V2; ) g2 = V2, k2 = g2.child, 22 === g2.tag && null !== g2.memoizedState ? jk(e2) : null !== k2 ? (k2.return = g2, V2 = k2) : jk(e2);
            for (; null !== f2; ) V2 = f2, ik(f2), f2 = f2.sibling;
            V2 = e2;
            Jj = h2;
            U2 = l2;
          }
          kk(a2);
        } else 0 !== (e2.subtreeFlags & 8772) && null !== f2 ? (f2.return = e2, V2 = f2) : kk(a2);
      }
    }
    function kk(a2) {
      for (; null !== V2; ) {
        var b2 = V2;
        if (0 !== (b2.flags & 8772)) {
          var c2 = b2.alternate;
          try {
            if (0 !== (b2.flags & 8772)) switch (b2.tag) {
              case 0:
              case 11:
              case 15:
                U2 || Qj(5, b2);
                break;
              case 1:
                var d2 = b2.stateNode;
                if (b2.flags & 4 && !U2) if (null === c2) d2.componentDidMount();
                else {
                  var e2 = b2.elementType === b2.type ? c2.memoizedProps : Ci2(b2.type, c2.memoizedProps);
                  d2.componentDidUpdate(e2, c2.memoizedState, d2.__reactInternalSnapshotBeforeUpdate);
                }
                var f2 = b2.updateQueue;
                null !== f2 && sh(b2, f2, d2);
                break;
              case 3:
                var g2 = b2.updateQueue;
                if (null !== g2) {
                  c2 = null;
                  if (null !== b2.child) switch (b2.child.tag) {
                    case 5:
                      c2 = b2.child.stateNode;
                      break;
                    case 1:
                      c2 = b2.child.stateNode;
                  }
                  sh(b2, g2, c2);
                }
                break;
              case 5:
                var h2 = b2.stateNode;
                if (null === c2 && b2.flags & 4) {
                  c2 = h2;
                  var k2 = b2.memoizedProps;
                  switch (b2.type) {
                    case "button":
                    case "input":
                    case "select":
                    case "textarea":
                      k2.autoFocus && c2.focus();
                      break;
                    case "img":
                      k2.src && (c2.src = k2.src);
                  }
                }
                break;
              case 6:
                break;
              case 4:
                break;
              case 12:
                break;
              case 13:
                if (null === b2.memoizedState) {
                  var l2 = b2.alternate;
                  if (null !== l2) {
                    var m2 = l2.memoizedState;
                    if (null !== m2) {
                      var q2 = m2.dehydrated;
                      null !== q2 && bd(q2);
                    }
                  }
                }
                break;
              case 19:
              case 17:
              case 21:
              case 22:
              case 23:
              case 25:
                break;
              default:
                throw Error(p2(163));
            }
            U2 || b2.flags & 512 && Rj(b2);
          } catch (r2) {
            W2(b2, b2.return, r2);
          }
        }
        if (b2 === a2) {
          V2 = null;
          break;
        }
        c2 = b2.sibling;
        if (null !== c2) {
          c2.return = b2.return;
          V2 = c2;
          break;
        }
        V2 = b2.return;
      }
    }
    function gk(a2) {
      for (; null !== V2; ) {
        var b2 = V2;
        if (b2 === a2) {
          V2 = null;
          break;
        }
        var c2 = b2.sibling;
        if (null !== c2) {
          c2.return = b2.return;
          V2 = c2;
          break;
        }
        V2 = b2.return;
      }
    }
    function jk(a2) {
      for (; null !== V2; ) {
        var b2 = V2;
        try {
          switch (b2.tag) {
            case 0:
            case 11:
            case 15:
              var c2 = b2.return;
              try {
                Qj(4, b2);
              } catch (k2) {
                W2(b2, c2, k2);
              }
              break;
            case 1:
              var d2 = b2.stateNode;
              if ("function" === typeof d2.componentDidMount) {
                var e2 = b2.return;
                try {
                  d2.componentDidMount();
                } catch (k2) {
                  W2(b2, e2, k2);
                }
              }
              var f2 = b2.return;
              try {
                Rj(b2);
              } catch (k2) {
                W2(b2, f2, k2);
              }
              break;
            case 5:
              var g2 = b2.return;
              try {
                Rj(b2);
              } catch (k2) {
                W2(b2, g2, k2);
              }
          }
        } catch (k2) {
          W2(b2, b2.return, k2);
        }
        if (b2 === a2) {
          V2 = null;
          break;
        }
        var h2 = b2.sibling;
        if (null !== h2) {
          h2.return = b2.return;
          V2 = h2;
          break;
        }
        V2 = b2.return;
      }
    }
    var lk = Math.ceil, mk = ua.ReactCurrentDispatcher, nk = ua.ReactCurrentOwner, ok = ua.ReactCurrentBatchConfig, K2 = 0, Q2 = null, Y2 = null, Z2 = 0, fj = 0, ej = Uf(0), T2 = 0, pk = null, rh = 0, qk = 0, rk = 0, sk = null, tk = null, fk = 0, Gj = Infinity, uk = null, Oi2 = false, Pi2 = null, Ri2 = null, vk = false, wk = null, xk = 0, yk = 0, zk = null, Ak = -1, Bk = 0;
    function R2() {
      return 0 !== (K2 & 6) ? B2() : -1 !== Ak ? Ak : Ak = B2();
    }
    function yi2(a2) {
      if (0 === (a2.mode & 1)) return 1;
      if (0 !== (K2 & 2) && 0 !== Z2) return Z2 & -Z2;
      if (null !== Kg.transition) return 0 === Bk && (Bk = yc()), Bk;
      a2 = C2;
      if (0 !== a2) return a2;
      a2 = window.event;
      a2 = void 0 === a2 ? 16 : jd(a2.type);
      return a2;
    }
    function gi2(a2, b2, c2, d2) {
      if (50 < yk) throw yk = 0, zk = null, Error(p2(185));
      Ac(a2, c2, d2);
      if (0 === (K2 & 2) || a2 !== Q2) a2 === Q2 && (0 === (K2 & 2) && (qk |= c2), 4 === T2 && Ck(a2, Z2)), Dk(a2, d2), 1 === c2 && 0 === K2 && 0 === (b2.mode & 1) && (Gj = B2() + 500, fg && jg());
    }
    function Dk(a2, b2) {
      var c2 = a2.callbackNode;
      wc(a2, b2);
      var d2 = uc(a2, a2 === Q2 ? Z2 : 0);
      if (0 === d2) null !== c2 && bc(c2), a2.callbackNode = null, a2.callbackPriority = 0;
      else if (b2 = d2 & -d2, a2.callbackPriority !== b2) {
        null != c2 && bc(c2);
        if (1 === b2) 0 === a2.tag ? ig(Ek.bind(null, a2)) : hg(Ek.bind(null, a2)), Jf(function() {
          0 === (K2 & 6) && jg();
        }), c2 = null;
        else {
          switch (Dc(d2)) {
            case 1:
              c2 = fc;
              break;
            case 4:
              c2 = gc;
              break;
            case 16:
              c2 = hc;
              break;
            case 536870912:
              c2 = jc;
              break;
            default:
              c2 = hc;
          }
          c2 = Fk(c2, Gk.bind(null, a2));
        }
        a2.callbackPriority = b2;
        a2.callbackNode = c2;
      }
    }
    function Gk(a2, b2) {
      Ak = -1;
      Bk = 0;
      if (0 !== (K2 & 6)) throw Error(p2(327));
      var c2 = a2.callbackNode;
      if (Hk() && a2.callbackNode !== c2) return null;
      var d2 = uc(a2, a2 === Q2 ? Z2 : 0);
      if (0 === d2) return null;
      if (0 !== (d2 & 30) || 0 !== (d2 & a2.expiredLanes) || b2) b2 = Ik(a2, d2);
      else {
        b2 = d2;
        var e2 = K2;
        K2 |= 2;
        var f2 = Jk();
        if (Q2 !== a2 || Z2 !== b2) uk = null, Gj = B2() + 500, Kk(a2, b2);
        do
          try {
            Lk();
            break;
          } catch (h2) {
            Mk(a2, h2);
          }
        while (1);
        $g();
        mk.current = f2;
        K2 = e2;
        null !== Y2 ? b2 = 0 : (Q2 = null, Z2 = 0, b2 = T2);
      }
      if (0 !== b2) {
        2 === b2 && (e2 = xc(a2), 0 !== e2 && (d2 = e2, b2 = Nk(a2, e2)));
        if (1 === b2) throw c2 = pk, Kk(a2, 0), Ck(a2, d2), Dk(a2, B2()), c2;
        if (6 === b2) Ck(a2, d2);
        else {
          e2 = a2.current.alternate;
          if (0 === (d2 & 30) && !Ok(e2) && (b2 = Ik(a2, d2), 2 === b2 && (f2 = xc(a2), 0 !== f2 && (d2 = f2, b2 = Nk(a2, f2))), 1 === b2)) throw c2 = pk, Kk(a2, 0), Ck(a2, d2), Dk(a2, B2()), c2;
          a2.finishedWork = e2;
          a2.finishedLanes = d2;
          switch (b2) {
            case 0:
            case 1:
              throw Error(p2(345));
            case 2:
              Pk(a2, tk, uk);
              break;
            case 3:
              Ck(a2, d2);
              if ((d2 & 130023424) === d2 && (b2 = fk + 500 - B2(), 10 < b2)) {
                if (0 !== uc(a2, 0)) break;
                e2 = a2.suspendedLanes;
                if ((e2 & d2) !== d2) {
                  R2();
                  a2.pingedLanes |= a2.suspendedLanes & e2;
                  break;
                }
                a2.timeoutHandle = Ff(Pk.bind(null, a2, tk, uk), b2);
                break;
              }
              Pk(a2, tk, uk);
              break;
            case 4:
              Ck(a2, d2);
              if ((d2 & 4194240) === d2) break;
              b2 = a2.eventTimes;
              for (e2 = -1; 0 < d2; ) {
                var g2 = 31 - oc(d2);
                f2 = 1 << g2;
                g2 = b2[g2];
                g2 > e2 && (e2 = g2);
                d2 &= ~f2;
              }
              d2 = e2;
              d2 = B2() - d2;
              d2 = (120 > d2 ? 120 : 480 > d2 ? 480 : 1080 > d2 ? 1080 : 1920 > d2 ? 1920 : 3e3 > d2 ? 3e3 : 4320 > d2 ? 4320 : 1960 * lk(d2 / 1960)) - d2;
              if (10 < d2) {
                a2.timeoutHandle = Ff(Pk.bind(null, a2, tk, uk), d2);
                break;
              }
              Pk(a2, tk, uk);
              break;
            case 5:
              Pk(a2, tk, uk);
              break;
            default:
              throw Error(p2(329));
          }
        }
      }
      Dk(a2, B2());
      return a2.callbackNode === c2 ? Gk.bind(null, a2) : null;
    }
    function Nk(a2, b2) {
      var c2 = sk;
      a2.current.memoizedState.isDehydrated && (Kk(a2, b2).flags |= 256);
      a2 = Ik(a2, b2);
      2 !== a2 && (b2 = tk, tk = c2, null !== b2 && Fj(b2));
      return a2;
    }
    function Fj(a2) {
      null === tk ? tk = a2 : tk.push.apply(tk, a2);
    }
    function Ok(a2) {
      for (var b2 = a2; ; ) {
        if (b2.flags & 16384) {
          var c2 = b2.updateQueue;
          if (null !== c2 && (c2 = c2.stores, null !== c2)) for (var d2 = 0; d2 < c2.length; d2++) {
            var e2 = c2[d2], f2 = e2.getSnapshot;
            e2 = e2.value;
            try {
              if (!He2(f2(), e2)) return false;
            } catch (g2) {
              return false;
            }
          }
        }
        c2 = b2.child;
        if (b2.subtreeFlags & 16384 && null !== c2) c2.return = b2, b2 = c2;
        else {
          if (b2 === a2) break;
          for (; null === b2.sibling; ) {
            if (null === b2.return || b2.return === a2) return true;
            b2 = b2.return;
          }
          b2.sibling.return = b2.return;
          b2 = b2.sibling;
        }
      }
      return true;
    }
    function Ck(a2, b2) {
      b2 &= ~rk;
      b2 &= ~qk;
      a2.suspendedLanes |= b2;
      a2.pingedLanes &= ~b2;
      for (a2 = a2.expirationTimes; 0 < b2; ) {
        var c2 = 31 - oc(b2), d2 = 1 << c2;
        a2[c2] = -1;
        b2 &= ~d2;
      }
    }
    function Ek(a2) {
      if (0 !== (K2 & 6)) throw Error(p2(327));
      Hk();
      var b2 = uc(a2, 0);
      if (0 === (b2 & 1)) return Dk(a2, B2()), null;
      var c2 = Ik(a2, b2);
      if (0 !== a2.tag && 2 === c2) {
        var d2 = xc(a2);
        0 !== d2 && (b2 = d2, c2 = Nk(a2, d2));
      }
      if (1 === c2) throw c2 = pk, Kk(a2, 0), Ck(a2, b2), Dk(a2, B2()), c2;
      if (6 === c2) throw Error(p2(345));
      a2.finishedWork = a2.current.alternate;
      a2.finishedLanes = b2;
      Pk(a2, tk, uk);
      Dk(a2, B2());
      return null;
    }
    function Qk(a2, b2) {
      var c2 = K2;
      K2 |= 1;
      try {
        return a2(b2);
      } finally {
        K2 = c2, 0 === K2 && (Gj = B2() + 500, fg && jg());
      }
    }
    function Rk(a2) {
      null !== wk && 0 === wk.tag && 0 === (K2 & 6) && Hk();
      var b2 = K2;
      K2 |= 1;
      var c2 = ok.transition, d2 = C2;
      try {
        if (ok.transition = null, C2 = 1, a2) return a2();
      } finally {
        C2 = d2, ok.transition = c2, K2 = b2, 0 === (K2 & 6) && jg();
      }
    }
    function Hj() {
      fj = ej.current;
      E2(ej);
    }
    function Kk(a2, b2) {
      a2.finishedWork = null;
      a2.finishedLanes = 0;
      var c2 = a2.timeoutHandle;
      -1 !== c2 && (a2.timeoutHandle = -1, Gf(c2));
      if (null !== Y2) for (c2 = Y2.return; null !== c2; ) {
        var d2 = c2;
        wg(d2);
        switch (d2.tag) {
          case 1:
            d2 = d2.type.childContextTypes;
            null !== d2 && void 0 !== d2 && $f();
            break;
          case 3:
            zh();
            E2(Wf);
            E2(H2);
            Eh();
            break;
          case 5:
            Bh(d2);
            break;
          case 4:
            zh();
            break;
          case 13:
            E2(L2);
            break;
          case 19:
            E2(L2);
            break;
          case 10:
            ah(d2.type._context);
            break;
          case 22:
          case 23:
            Hj();
        }
        c2 = c2.return;
      }
      Q2 = a2;
      Y2 = a2 = Pg(a2.current, null);
      Z2 = fj = b2;
      T2 = 0;
      pk = null;
      rk = qk = rh = 0;
      tk = sk = null;
      if (null !== fh) {
        for (b2 = 0; b2 < fh.length; b2++) if (c2 = fh[b2], d2 = c2.interleaved, null !== d2) {
          c2.interleaved = null;
          var e2 = d2.next, f2 = c2.pending;
          if (null !== f2) {
            var g2 = f2.next;
            f2.next = e2;
            d2.next = g2;
          }
          c2.pending = d2;
        }
        fh = null;
      }
      return a2;
    }
    function Mk(a2, b2) {
      do {
        var c2 = Y2;
        try {
          $g();
          Fh.current = Rh;
          if (Ih) {
            for (var d2 = M2.memoizedState; null !== d2; ) {
              var e2 = d2.queue;
              null !== e2 && (e2.pending = null);
              d2 = d2.next;
            }
            Ih = false;
          }
          Hh = 0;
          O2 = N2 = M2 = null;
          Jh = false;
          Kh = 0;
          nk.current = null;
          if (null === c2 || null === c2.return) {
            T2 = 1;
            pk = b2;
            Y2 = null;
            break;
          }
          a: {
            var f2 = a2, g2 = c2.return, h2 = c2, k2 = b2;
            b2 = Z2;
            h2.flags |= 32768;
            if (null !== k2 && "object" === typeof k2 && "function" === typeof k2.then) {
              var l2 = k2, m2 = h2, q2 = m2.tag;
              if (0 === (m2.mode & 1) && (0 === q2 || 11 === q2 || 15 === q2)) {
                var r2 = m2.alternate;
                r2 ? (m2.updateQueue = r2.updateQueue, m2.memoizedState = r2.memoizedState, m2.lanes = r2.lanes) : (m2.updateQueue = null, m2.memoizedState = null);
              }
              var y2 = Ui2(g2);
              if (null !== y2) {
                y2.flags &= -257;
                Vi2(y2, g2, h2, f2, b2);
                y2.mode & 1 && Si2(f2, l2, b2);
                b2 = y2;
                k2 = l2;
                var n2 = b2.updateQueue;
                if (null === n2) {
                  var t2 = /* @__PURE__ */ new Set();
                  t2.add(k2);
                  b2.updateQueue = t2;
                } else n2.add(k2);
                break a;
              } else {
                if (0 === (b2 & 1)) {
                  Si2(f2, l2, b2);
                  tj();
                  break a;
                }
                k2 = Error(p2(426));
              }
            } else if (I2 && h2.mode & 1) {
              var J2 = Ui2(g2);
              if (null !== J2) {
                0 === (J2.flags & 65536) && (J2.flags |= 256);
                Vi2(J2, g2, h2, f2, b2);
                Jg(Ji2(k2, h2));
                break a;
              }
            }
            f2 = k2 = Ji2(k2, h2);
            4 !== T2 && (T2 = 2);
            null === sk ? sk = [f2] : sk.push(f2);
            f2 = g2;
            do {
              switch (f2.tag) {
                case 3:
                  f2.flags |= 65536;
                  b2 &= -b2;
                  f2.lanes |= b2;
                  var x2 = Ni2(f2, k2, b2);
                  ph(f2, x2);
                  break a;
                case 1:
                  h2 = k2;
                  var w2 = f2.type, u2 = f2.stateNode;
                  if (0 === (f2.flags & 128) && ("function" === typeof w2.getDerivedStateFromError || null !== u2 && "function" === typeof u2.componentDidCatch && (null === Ri2 || !Ri2.has(u2)))) {
                    f2.flags |= 65536;
                    b2 &= -b2;
                    f2.lanes |= b2;
                    var F2 = Qi2(f2, h2, b2);
                    ph(f2, F2);
                    break a;
                  }
              }
              f2 = f2.return;
            } while (null !== f2);
          }
          Sk(c2);
        } catch (na) {
          b2 = na;
          Y2 === c2 && null !== c2 && (Y2 = c2 = c2.return);
          continue;
        }
        break;
      } while (1);
    }
    function Jk() {
      var a2 = mk.current;
      mk.current = Rh;
      return null === a2 ? Rh : a2;
    }
    function tj() {
      if (0 === T2 || 3 === T2 || 2 === T2) T2 = 4;
      null === Q2 || 0 === (rh & 268435455) && 0 === (qk & 268435455) || Ck(Q2, Z2);
    }
    function Ik(a2, b2) {
      var c2 = K2;
      K2 |= 2;
      var d2 = Jk();
      if (Q2 !== a2 || Z2 !== b2) uk = null, Kk(a2, b2);
      do
        try {
          Tk();
          break;
        } catch (e2) {
          Mk(a2, e2);
        }
      while (1);
      $g();
      K2 = c2;
      mk.current = d2;
      if (null !== Y2) throw Error(p2(261));
      Q2 = null;
      Z2 = 0;
      return T2;
    }
    function Tk() {
      for (; null !== Y2; ) Uk(Y2);
    }
    function Lk() {
      for (; null !== Y2 && !cc(); ) Uk(Y2);
    }
    function Uk(a2) {
      var b2 = Vk(a2.alternate, a2, fj);
      a2.memoizedProps = a2.pendingProps;
      null === b2 ? Sk(a2) : Y2 = b2;
      nk.current = null;
    }
    function Sk(a2) {
      var b2 = a2;
      do {
        var c2 = b2.alternate;
        a2 = b2.return;
        if (0 === (b2.flags & 32768)) {
          if (c2 = Ej(c2, b2, fj), null !== c2) {
            Y2 = c2;
            return;
          }
        } else {
          c2 = Ij(c2, b2);
          if (null !== c2) {
            c2.flags &= 32767;
            Y2 = c2;
            return;
          }
          if (null !== a2) a2.flags |= 32768, a2.subtreeFlags = 0, a2.deletions = null;
          else {
            T2 = 6;
            Y2 = null;
            return;
          }
        }
        b2 = b2.sibling;
        if (null !== b2) {
          Y2 = b2;
          return;
        }
        Y2 = b2 = a2;
      } while (null !== b2);
      0 === T2 && (T2 = 5);
    }
    function Pk(a2, b2, c2) {
      var d2 = C2, e2 = ok.transition;
      try {
        ok.transition = null, C2 = 1, Wk(a2, b2, c2, d2);
      } finally {
        ok.transition = e2, C2 = d2;
      }
      return null;
    }
    function Wk(a2, b2, c2, d2) {
      do
        Hk();
      while (null !== wk);
      if (0 !== (K2 & 6)) throw Error(p2(327));
      c2 = a2.finishedWork;
      var e2 = a2.finishedLanes;
      if (null === c2) return null;
      a2.finishedWork = null;
      a2.finishedLanes = 0;
      if (c2 === a2.current) throw Error(p2(177));
      a2.callbackNode = null;
      a2.callbackPriority = 0;
      var f2 = c2.lanes | c2.childLanes;
      Bc(a2, f2);
      a2 === Q2 && (Y2 = Q2 = null, Z2 = 0);
      0 === (c2.subtreeFlags & 2064) && 0 === (c2.flags & 2064) || vk || (vk = true, Fk(hc, function() {
        Hk();
        return null;
      }));
      f2 = 0 !== (c2.flags & 15990);
      if (0 !== (c2.subtreeFlags & 15990) || f2) {
        f2 = ok.transition;
        ok.transition = null;
        var g2 = C2;
        C2 = 1;
        var h2 = K2;
        K2 |= 4;
        nk.current = null;
        Oj(a2, c2);
        dk(c2, a2);
        Oe2(Df);
        dd = !!Cf;
        Df = Cf = null;
        a2.current = c2;
        hk(c2);
        dc();
        K2 = h2;
        C2 = g2;
        ok.transition = f2;
      } else a2.current = c2;
      vk && (vk = false, wk = a2, xk = e2);
      f2 = a2.pendingLanes;
      0 === f2 && (Ri2 = null);
      mc(c2.stateNode);
      Dk(a2, B2());
      if (null !== b2) for (d2 = a2.onRecoverableError, c2 = 0; c2 < b2.length; c2++) e2 = b2[c2], d2(e2.value, { componentStack: e2.stack, digest: e2.digest });
      if (Oi2) throw Oi2 = false, a2 = Pi2, Pi2 = null, a2;
      0 !== (xk & 1) && 0 !== a2.tag && Hk();
      f2 = a2.pendingLanes;
      0 !== (f2 & 1) ? a2 === zk ? yk++ : (yk = 0, zk = a2) : yk = 0;
      jg();
      return null;
    }
    function Hk() {
      if (null !== wk) {
        var a2 = Dc(xk), b2 = ok.transition, c2 = C2;
        try {
          ok.transition = null;
          C2 = 16 > a2 ? 16 : a2;
          if (null === wk) var d2 = false;
          else {
            a2 = wk;
            wk = null;
            xk = 0;
            if (0 !== (K2 & 6)) throw Error(p2(331));
            var e2 = K2;
            K2 |= 4;
            for (V2 = a2.current; null !== V2; ) {
              var f2 = V2, g2 = f2.child;
              if (0 !== (V2.flags & 16)) {
                var h2 = f2.deletions;
                if (null !== h2) {
                  for (var k2 = 0; k2 < h2.length; k2++) {
                    var l2 = h2[k2];
                    for (V2 = l2; null !== V2; ) {
                      var m2 = V2;
                      switch (m2.tag) {
                        case 0:
                        case 11:
                        case 15:
                          Pj(8, m2, f2);
                      }
                      var q2 = m2.child;
                      if (null !== q2) q2.return = m2, V2 = q2;
                      else for (; null !== V2; ) {
                        m2 = V2;
                        var r2 = m2.sibling, y2 = m2.return;
                        Sj(m2);
                        if (m2 === l2) {
                          V2 = null;
                          break;
                        }
                        if (null !== r2) {
                          r2.return = y2;
                          V2 = r2;
                          break;
                        }
                        V2 = y2;
                      }
                    }
                  }
                  var n2 = f2.alternate;
                  if (null !== n2) {
                    var t2 = n2.child;
                    if (null !== t2) {
                      n2.child = null;
                      do {
                        var J2 = t2.sibling;
                        t2.sibling = null;
                        t2 = J2;
                      } while (null !== t2);
                    }
                  }
                  V2 = f2;
                }
              }
              if (0 !== (f2.subtreeFlags & 2064) && null !== g2) g2.return = f2, V2 = g2;
              else b: for (; null !== V2; ) {
                f2 = V2;
                if (0 !== (f2.flags & 2048)) switch (f2.tag) {
                  case 0:
                  case 11:
                  case 15:
                    Pj(9, f2, f2.return);
                }
                var x2 = f2.sibling;
                if (null !== x2) {
                  x2.return = f2.return;
                  V2 = x2;
                  break b;
                }
                V2 = f2.return;
              }
            }
            var w2 = a2.current;
            for (V2 = w2; null !== V2; ) {
              g2 = V2;
              var u2 = g2.child;
              if (0 !== (g2.subtreeFlags & 2064) && null !== u2) u2.return = g2, V2 = u2;
              else b: for (g2 = w2; null !== V2; ) {
                h2 = V2;
                if (0 !== (h2.flags & 2048)) try {
                  switch (h2.tag) {
                    case 0:
                    case 11:
                    case 15:
                      Qj(9, h2);
                  }
                } catch (na) {
                  W2(h2, h2.return, na);
                }
                if (h2 === g2) {
                  V2 = null;
                  break b;
                }
                var F2 = h2.sibling;
                if (null !== F2) {
                  F2.return = h2.return;
                  V2 = F2;
                  break b;
                }
                V2 = h2.return;
              }
            }
            K2 = e2;
            jg();
            if (lc && "function" === typeof lc.onPostCommitFiberRoot) try {
              lc.onPostCommitFiberRoot(kc, a2);
            } catch (na) {
            }
            d2 = true;
          }
          return d2;
        } finally {
          C2 = c2, ok.transition = b2;
        }
      }
      return false;
    }
    function Xk(a2, b2, c2) {
      b2 = Ji2(c2, b2);
      b2 = Ni2(a2, b2, 1);
      a2 = nh(a2, b2, 1);
      b2 = R2();
      null !== a2 && (Ac(a2, 1, b2), Dk(a2, b2));
    }
    function W2(a2, b2, c2) {
      if (3 === a2.tag) Xk(a2, a2, c2);
      else for (; null !== b2; ) {
        if (3 === b2.tag) {
          Xk(b2, a2, c2);
          break;
        } else if (1 === b2.tag) {
          var d2 = b2.stateNode;
          if ("function" === typeof b2.type.getDerivedStateFromError || "function" === typeof d2.componentDidCatch && (null === Ri2 || !Ri2.has(d2))) {
            a2 = Ji2(c2, a2);
            a2 = Qi2(b2, a2, 1);
            b2 = nh(b2, a2, 1);
            a2 = R2();
            null !== b2 && (Ac(b2, 1, a2), Dk(b2, a2));
            break;
          }
        }
        b2 = b2.return;
      }
    }
    function Ti2(a2, b2, c2) {
      var d2 = a2.pingCache;
      null !== d2 && d2.delete(b2);
      b2 = R2();
      a2.pingedLanes |= a2.suspendedLanes & c2;
      Q2 === a2 && (Z2 & c2) === c2 && (4 === T2 || 3 === T2 && (Z2 & 130023424) === Z2 && 500 > B2() - fk ? Kk(a2, 0) : rk |= c2);
      Dk(a2, b2);
    }
    function Yk(a2, b2) {
      0 === b2 && (0 === (a2.mode & 1) ? b2 = 1 : (b2 = sc, sc <<= 1, 0 === (sc & 130023424) && (sc = 4194304)));
      var c2 = R2();
      a2 = ih(a2, b2);
      null !== a2 && (Ac(a2, b2, c2), Dk(a2, c2));
    }
    function uj(a2) {
      var b2 = a2.memoizedState, c2 = 0;
      null !== b2 && (c2 = b2.retryLane);
      Yk(a2, c2);
    }
    function bk(a2, b2) {
      var c2 = 0;
      switch (a2.tag) {
        case 13:
          var d2 = a2.stateNode;
          var e2 = a2.memoizedState;
          null !== e2 && (c2 = e2.retryLane);
          break;
        case 19:
          d2 = a2.stateNode;
          break;
        default:
          throw Error(p2(314));
      }
      null !== d2 && d2.delete(b2);
      Yk(a2, c2);
    }
    var Vk;
    Vk = function(a2, b2, c2) {
      if (null !== a2) if (a2.memoizedProps !== b2.pendingProps || Wf.current) dh = true;
      else {
        if (0 === (a2.lanes & c2) && 0 === (b2.flags & 128)) return dh = false, yj(a2, b2, c2);
        dh = 0 !== (a2.flags & 131072) ? true : false;
      }
      else dh = false, I2 && 0 !== (b2.flags & 1048576) && ug(b2, ng, b2.index);
      b2.lanes = 0;
      switch (b2.tag) {
        case 2:
          var d2 = b2.type;
          ij(a2, b2);
          a2 = b2.pendingProps;
          var e2 = Yf(b2, H2.current);
          ch(b2, c2);
          e2 = Nh(null, b2, d2, a2, e2, c2);
          var f2 = Sh();
          b2.flags |= 1;
          "object" === typeof e2 && null !== e2 && "function" === typeof e2.render && void 0 === e2.$$typeof ? (b2.tag = 1, b2.memoizedState = null, b2.updateQueue = null, Zf(d2) ? (f2 = true, cg(b2)) : f2 = false, b2.memoizedState = null !== e2.state && void 0 !== e2.state ? e2.state : null, kh(b2), e2.updater = Ei2, b2.stateNode = e2, e2._reactInternals = b2, Ii2(b2, d2, a2, c2), b2 = jj(null, b2, d2, true, f2, c2)) : (b2.tag = 0, I2 && f2 && vg(b2), Xi2(null, b2, e2, c2), b2 = b2.child);
          return b2;
        case 16:
          d2 = b2.elementType;
          a: {
            ij(a2, b2);
            a2 = b2.pendingProps;
            e2 = d2._init;
            d2 = e2(d2._payload);
            b2.type = d2;
            e2 = b2.tag = Zk(d2);
            a2 = Ci2(d2, a2);
            switch (e2) {
              case 0:
                b2 = cj(null, b2, d2, a2, c2);
                break a;
              case 1:
                b2 = hj(null, b2, d2, a2, c2);
                break a;
              case 11:
                b2 = Yi2(null, b2, d2, a2, c2);
                break a;
              case 14:
                b2 = $i2(null, b2, d2, Ci2(d2.type, a2), c2);
                break a;
            }
            throw Error(p2(
              306,
              d2,
              ""
            ));
          }
          return b2;
        case 0:
          return d2 = b2.type, e2 = b2.pendingProps, e2 = b2.elementType === d2 ? e2 : Ci2(d2, e2), cj(a2, b2, d2, e2, c2);
        case 1:
          return d2 = b2.type, e2 = b2.pendingProps, e2 = b2.elementType === d2 ? e2 : Ci2(d2, e2), hj(a2, b2, d2, e2, c2);
        case 3:
          a: {
            kj(b2);
            if (null === a2) throw Error(p2(387));
            d2 = b2.pendingProps;
            f2 = b2.memoizedState;
            e2 = f2.element;
            lh(a2, b2);
            qh(b2, d2, null, c2);
            var g2 = b2.memoizedState;
            d2 = g2.element;
            if (f2.isDehydrated) if (f2 = { element: d2, isDehydrated: false, cache: g2.cache, pendingSuspenseBoundaries: g2.pendingSuspenseBoundaries, transitions: g2.transitions }, b2.updateQueue.baseState = f2, b2.memoizedState = f2, b2.flags & 256) {
              e2 = Ji2(Error(p2(423)), b2);
              b2 = lj(a2, b2, d2, c2, e2);
              break a;
            } else if (d2 !== e2) {
              e2 = Ji2(Error(p2(424)), b2);
              b2 = lj(a2, b2, d2, c2, e2);
              break a;
            } else for (yg = Lf(b2.stateNode.containerInfo.firstChild), xg = b2, I2 = true, zg = null, c2 = Vg(b2, null, d2, c2), b2.child = c2; c2; ) c2.flags = c2.flags & -3 | 4096, c2 = c2.sibling;
            else {
              Ig();
              if (d2 === e2) {
                b2 = Zi2(a2, b2, c2);
                break a;
              }
              Xi2(a2, b2, d2, c2);
            }
            b2 = b2.child;
          }
          return b2;
        case 5:
          return Ah(b2), null === a2 && Eg(b2), d2 = b2.type, e2 = b2.pendingProps, f2 = null !== a2 ? a2.memoizedProps : null, g2 = e2.children, Ef(d2, e2) ? g2 = null : null !== f2 && Ef(d2, f2) && (b2.flags |= 32), gj(a2, b2), Xi2(a2, b2, g2, c2), b2.child;
        case 6:
          return null === a2 && Eg(b2), null;
        case 13:
          return oj(a2, b2, c2);
        case 4:
          return yh(b2, b2.stateNode.containerInfo), d2 = b2.pendingProps, null === a2 ? b2.child = Ug(b2, null, d2, c2) : Xi2(a2, b2, d2, c2), b2.child;
        case 11:
          return d2 = b2.type, e2 = b2.pendingProps, e2 = b2.elementType === d2 ? e2 : Ci2(d2, e2), Yi2(a2, b2, d2, e2, c2);
        case 7:
          return Xi2(a2, b2, b2.pendingProps, c2), b2.child;
        case 8:
          return Xi2(a2, b2, b2.pendingProps.children, c2), b2.child;
        case 12:
          return Xi2(a2, b2, b2.pendingProps.children, c2), b2.child;
        case 10:
          a: {
            d2 = b2.type._context;
            e2 = b2.pendingProps;
            f2 = b2.memoizedProps;
            g2 = e2.value;
            G2(Wg, d2._currentValue);
            d2._currentValue = g2;
            if (null !== f2) if (He2(f2.value, g2)) {
              if (f2.children === e2.children && !Wf.current) {
                b2 = Zi2(a2, b2, c2);
                break a;
              }
            } else for (f2 = b2.child, null !== f2 && (f2.return = b2); null !== f2; ) {
              var h2 = f2.dependencies;
              if (null !== h2) {
                g2 = f2.child;
                for (var k2 = h2.firstContext; null !== k2; ) {
                  if (k2.context === d2) {
                    if (1 === f2.tag) {
                      k2 = mh(-1, c2 & -c2);
                      k2.tag = 2;
                      var l2 = f2.updateQueue;
                      if (null !== l2) {
                        l2 = l2.shared;
                        var m2 = l2.pending;
                        null === m2 ? k2.next = k2 : (k2.next = m2.next, m2.next = k2);
                        l2.pending = k2;
                      }
                    }
                    f2.lanes |= c2;
                    k2 = f2.alternate;
                    null !== k2 && (k2.lanes |= c2);
                    bh(
                      f2.return,
                      c2,
                      b2
                    );
                    h2.lanes |= c2;
                    break;
                  }
                  k2 = k2.next;
                }
              } else if (10 === f2.tag) g2 = f2.type === b2.type ? null : f2.child;
              else if (18 === f2.tag) {
                g2 = f2.return;
                if (null === g2) throw Error(p2(341));
                g2.lanes |= c2;
                h2 = g2.alternate;
                null !== h2 && (h2.lanes |= c2);
                bh(g2, c2, b2);
                g2 = f2.sibling;
              } else g2 = f2.child;
              if (null !== g2) g2.return = f2;
              else for (g2 = f2; null !== g2; ) {
                if (g2 === b2) {
                  g2 = null;
                  break;
                }
                f2 = g2.sibling;
                if (null !== f2) {
                  f2.return = g2.return;
                  g2 = f2;
                  break;
                }
                g2 = g2.return;
              }
              f2 = g2;
            }
            Xi2(a2, b2, e2.children, c2);
            b2 = b2.child;
          }
          return b2;
        case 9:
          return e2 = b2.type, d2 = b2.pendingProps.children, ch(b2, c2), e2 = eh(e2), d2 = d2(e2), b2.flags |= 1, Xi2(a2, b2, d2, c2), b2.child;
        case 14:
          return d2 = b2.type, e2 = Ci2(d2, b2.pendingProps), e2 = Ci2(d2.type, e2), $i2(a2, b2, d2, e2, c2);
        case 15:
          return bj(a2, b2, b2.type, b2.pendingProps, c2);
        case 17:
          return d2 = b2.type, e2 = b2.pendingProps, e2 = b2.elementType === d2 ? e2 : Ci2(d2, e2), ij(a2, b2), b2.tag = 1, Zf(d2) ? (a2 = true, cg(b2)) : a2 = false, ch(b2, c2), Gi2(b2, d2, e2), Ii2(b2, d2, e2, c2), jj(null, b2, d2, true, a2, c2);
        case 19:
          return xj(a2, b2, c2);
        case 22:
          return dj(a2, b2, c2);
      }
      throw Error(p2(156, b2.tag));
    };
    function Fk(a2, b2) {
      return ac(a2, b2);
    }
    function $k(a2, b2, c2, d2) {
      this.tag = a2;
      this.key = c2;
      this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
      this.index = 0;
      this.ref = null;
      this.pendingProps = b2;
      this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
      this.mode = d2;
      this.subtreeFlags = this.flags = 0;
      this.deletions = null;
      this.childLanes = this.lanes = 0;
      this.alternate = null;
    }
    function Bg(a2, b2, c2, d2) {
      return new $k(a2, b2, c2, d2);
    }
    function aj(a2) {
      a2 = a2.prototype;
      return !(!a2 || !a2.isReactComponent);
    }
    function Zk(a2) {
      if ("function" === typeof a2) return aj(a2) ? 1 : 0;
      if (void 0 !== a2 && null !== a2) {
        a2 = a2.$$typeof;
        if (a2 === Da) return 11;
        if (a2 === Ga) return 14;
      }
      return 2;
    }
    function Pg(a2, b2) {
      var c2 = a2.alternate;
      null === c2 ? (c2 = Bg(a2.tag, b2, a2.key, a2.mode), c2.elementType = a2.elementType, c2.type = a2.type, c2.stateNode = a2.stateNode, c2.alternate = a2, a2.alternate = c2) : (c2.pendingProps = b2, c2.type = a2.type, c2.flags = 0, c2.subtreeFlags = 0, c2.deletions = null);
      c2.flags = a2.flags & 14680064;
      c2.childLanes = a2.childLanes;
      c2.lanes = a2.lanes;
      c2.child = a2.child;
      c2.memoizedProps = a2.memoizedProps;
      c2.memoizedState = a2.memoizedState;
      c2.updateQueue = a2.updateQueue;
      b2 = a2.dependencies;
      c2.dependencies = null === b2 ? null : { lanes: b2.lanes, firstContext: b2.firstContext };
      c2.sibling = a2.sibling;
      c2.index = a2.index;
      c2.ref = a2.ref;
      return c2;
    }
    function Rg(a2, b2, c2, d2, e2, f2) {
      var g2 = 2;
      d2 = a2;
      if ("function" === typeof a2) aj(a2) && (g2 = 1);
      else if ("string" === typeof a2) g2 = 5;
      else a: switch (a2) {
        case ya:
          return Tg(c2.children, e2, f2, b2);
        case za:
          g2 = 8;
          e2 |= 8;
          break;
        case Aa:
          return a2 = Bg(12, c2, b2, e2 | 2), a2.elementType = Aa, a2.lanes = f2, a2;
        case Ea:
          return a2 = Bg(13, c2, b2, e2), a2.elementType = Ea, a2.lanes = f2, a2;
        case Fa:
          return a2 = Bg(19, c2, b2, e2), a2.elementType = Fa, a2.lanes = f2, a2;
        case Ia:
          return pj(c2, e2, f2, b2);
        default:
          if ("object" === typeof a2 && null !== a2) switch (a2.$$typeof) {
            case Ba:
              g2 = 10;
              break a;
            case Ca:
              g2 = 9;
              break a;
            case Da:
              g2 = 11;
              break a;
            case Ga:
              g2 = 14;
              break a;
            case Ha:
              g2 = 16;
              d2 = null;
              break a;
          }
          throw Error(p2(130, null == a2 ? a2 : typeof a2, ""));
      }
      b2 = Bg(g2, c2, b2, e2);
      b2.elementType = a2;
      b2.type = d2;
      b2.lanes = f2;
      return b2;
    }
    function Tg(a2, b2, c2, d2) {
      a2 = Bg(7, a2, d2, b2);
      a2.lanes = c2;
      return a2;
    }
    function pj(a2, b2, c2, d2) {
      a2 = Bg(22, a2, d2, b2);
      a2.elementType = Ia;
      a2.lanes = c2;
      a2.stateNode = { isHidden: false };
      return a2;
    }
    function Qg(a2, b2, c2) {
      a2 = Bg(6, a2, null, b2);
      a2.lanes = c2;
      return a2;
    }
    function Sg(a2, b2, c2) {
      b2 = Bg(4, null !== a2.children ? a2.children : [], a2.key, b2);
      b2.lanes = c2;
      b2.stateNode = { containerInfo: a2.containerInfo, pendingChildren: null, implementation: a2.implementation };
      return b2;
    }
    function al(a2, b2, c2, d2, e2) {
      this.tag = b2;
      this.containerInfo = a2;
      this.finishedWork = this.pingCache = this.current = this.pendingChildren = null;
      this.timeoutHandle = -1;
      this.callbackNode = this.pendingContext = this.context = null;
      this.callbackPriority = 0;
      this.eventTimes = zc(0);
      this.expirationTimes = zc(-1);
      this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
      this.entanglements = zc(0);
      this.identifierPrefix = d2;
      this.onRecoverableError = e2;
      this.mutableSourceEagerHydrationData = null;
    }
    function bl(a2, b2, c2, d2, e2, f2, g2, h2, k2) {
      a2 = new al(a2, b2, c2, h2, k2);
      1 === b2 ? (b2 = 1, true === f2 && (b2 |= 8)) : b2 = 0;
      f2 = Bg(3, null, null, b2);
      a2.current = f2;
      f2.stateNode = a2;
      f2.memoizedState = { element: d2, isDehydrated: c2, cache: null, transitions: null, pendingSuspenseBoundaries: null };
      kh(f2);
      return a2;
    }
    function cl(a2, b2, c2) {
      var d2 = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
      return { $$typeof: wa, key: null == d2 ? null : "" + d2, children: a2, containerInfo: b2, implementation: c2 };
    }
    function dl(a2) {
      if (!a2) return Vf;
      a2 = a2._reactInternals;
      a: {
        if (Vb(a2) !== a2 || 1 !== a2.tag) throw Error(p2(170));
        var b2 = a2;
        do {
          switch (b2.tag) {
            case 3:
              b2 = b2.stateNode.context;
              break a;
            case 1:
              if (Zf(b2.type)) {
                b2 = b2.stateNode.__reactInternalMemoizedMergedChildContext;
                break a;
              }
          }
          b2 = b2.return;
        } while (null !== b2);
        throw Error(p2(171));
      }
      if (1 === a2.tag) {
        var c2 = a2.type;
        if (Zf(c2)) return bg(a2, c2, b2);
      }
      return b2;
    }
    function el(a2, b2, c2, d2, e2, f2, g2, h2, k2) {
      a2 = bl(c2, d2, true, a2, e2, f2, g2, h2, k2);
      a2.context = dl(null);
      c2 = a2.current;
      d2 = R2();
      e2 = yi2(c2);
      f2 = mh(d2, e2);
      f2.callback = void 0 !== b2 && null !== b2 ? b2 : null;
      nh(c2, f2, e2);
      a2.current.lanes = e2;
      Ac(a2, e2, d2);
      Dk(a2, d2);
      return a2;
    }
    function fl(a2, b2, c2, d2) {
      var e2 = b2.current, f2 = R2(), g2 = yi2(e2);
      c2 = dl(c2);
      null === b2.context ? b2.context = c2 : b2.pendingContext = c2;
      b2 = mh(f2, g2);
      b2.payload = { element: a2 };
      d2 = void 0 === d2 ? null : d2;
      null !== d2 && (b2.callback = d2);
      a2 = nh(e2, b2, g2);
      null !== a2 && (gi2(a2, e2, g2, f2), oh(a2, e2, g2));
      return g2;
    }
    function gl(a2) {
      a2 = a2.current;
      if (!a2.child) return null;
      switch (a2.child.tag) {
        case 5:
          return a2.child.stateNode;
        default:
          return a2.child.stateNode;
      }
    }
    function hl(a2, b2) {
      a2 = a2.memoizedState;
      if (null !== a2 && null !== a2.dehydrated) {
        var c2 = a2.retryLane;
        a2.retryLane = 0 !== c2 && c2 < b2 ? c2 : b2;
      }
    }
    function il(a2, b2) {
      hl(a2, b2);
      (a2 = a2.alternate) && hl(a2, b2);
    }
    function jl() {
      return null;
    }
    var kl = "function" === typeof reportError ? reportError : function(a2) {
      console.error(a2);
    };
    function ll(a2) {
      this._internalRoot = a2;
    }
    ml.prototype.render = ll.prototype.render = function(a2) {
      var b2 = this._internalRoot;
      if (null === b2) throw Error(p2(409));
      fl(a2, b2, null, null);
    };
    ml.prototype.unmount = ll.prototype.unmount = function() {
      var a2 = this._internalRoot;
      if (null !== a2) {
        this._internalRoot = null;
        var b2 = a2.containerInfo;
        Rk(function() {
          fl(null, a2, null, null);
        });
        b2[uf] = null;
      }
    };
    function ml(a2) {
      this._internalRoot = a2;
    }
    ml.prototype.unstable_scheduleHydration = function(a2) {
      if (a2) {
        var b2 = Hc();
        a2 = { blockedOn: null, target: a2, priority: b2 };
        for (var c2 = 0; c2 < Qc.length && 0 !== b2 && b2 < Qc[c2].priority; c2++) ;
        Qc.splice(c2, 0, a2);
        0 === c2 && Vc(a2);
      }
    };
    function nl(a2) {
      return !(!a2 || 1 !== a2.nodeType && 9 !== a2.nodeType && 11 !== a2.nodeType);
    }
    function ol(a2) {
      return !(!a2 || 1 !== a2.nodeType && 9 !== a2.nodeType && 11 !== a2.nodeType && (8 !== a2.nodeType || " react-mount-point-unstable " !== a2.nodeValue));
    }
    function pl() {
    }
    function ql(a2, b2, c2, d2, e2) {
      if (e2) {
        if ("function" === typeof d2) {
          var f2 = d2;
          d2 = function() {
            var a3 = gl(g2);
            f2.call(a3);
          };
        }
        var g2 = el(b2, d2, a2, 0, null, false, false, "", pl);
        a2._reactRootContainer = g2;
        a2[uf] = g2.current;
        sf(8 === a2.nodeType ? a2.parentNode : a2);
        Rk();
        return g2;
      }
      for (; e2 = a2.lastChild; ) a2.removeChild(e2);
      if ("function" === typeof d2) {
        var h2 = d2;
        d2 = function() {
          var a3 = gl(k2);
          h2.call(a3);
        };
      }
      var k2 = bl(a2, 0, false, null, null, false, false, "", pl);
      a2._reactRootContainer = k2;
      a2[uf] = k2.current;
      sf(8 === a2.nodeType ? a2.parentNode : a2);
      Rk(function() {
        fl(b2, k2, c2, d2);
      });
      return k2;
    }
    function rl(a2, b2, c2, d2, e2) {
      var f2 = c2._reactRootContainer;
      if (f2) {
        var g2 = f2;
        if ("function" === typeof e2) {
          var h2 = e2;
          e2 = function() {
            var a3 = gl(g2);
            h2.call(a3);
          };
        }
        fl(b2, g2, a2, e2);
      } else g2 = ql(c2, b2, a2, e2, d2);
      return gl(g2);
    }
    Ec = function(a2) {
      switch (a2.tag) {
        case 3:
          var b2 = a2.stateNode;
          if (b2.current.memoizedState.isDehydrated) {
            var c2 = tc(b2.pendingLanes);
            0 !== c2 && (Cc(b2, c2 | 1), Dk(b2, B2()), 0 === (K2 & 6) && (Gj = B2() + 500, jg()));
          }
          break;
        case 13:
          Rk(function() {
            var b3 = ih(a2, 1);
            if (null !== b3) {
              var c3 = R2();
              gi2(b3, a2, 1, c3);
            }
          }), il(a2, 1);
      }
    };
    Fc = function(a2) {
      if (13 === a2.tag) {
        var b2 = ih(a2, 134217728);
        if (null !== b2) {
          var c2 = R2();
          gi2(b2, a2, 134217728, c2);
        }
        il(a2, 134217728);
      }
    };
    Gc = function(a2) {
      if (13 === a2.tag) {
        var b2 = yi2(a2), c2 = ih(a2, b2);
        if (null !== c2) {
          var d2 = R2();
          gi2(c2, a2, b2, d2);
        }
        il(a2, b2);
      }
    };
    Hc = function() {
      return C2;
    };
    Ic = function(a2, b2) {
      var c2 = C2;
      try {
        return C2 = a2, b2();
      } finally {
        C2 = c2;
      }
    };
    yb = function(a2, b2, c2) {
      switch (b2) {
        case "input":
          bb(a2, c2);
          b2 = c2.name;
          if ("radio" === c2.type && null != b2) {
            for (c2 = a2; c2.parentNode; ) c2 = c2.parentNode;
            c2 = c2.querySelectorAll("input[name=" + JSON.stringify("" + b2) + '][type="radio"]');
            for (b2 = 0; b2 < c2.length; b2++) {
              var d2 = c2[b2];
              if (d2 !== a2 && d2.form === a2.form) {
                var e2 = Db(d2);
                if (!e2) throw Error(p2(90));
                Wa(d2);
                bb(d2, e2);
              }
            }
          }
          break;
        case "textarea":
          ib(a2, c2);
          break;
        case "select":
          b2 = c2.value, null != b2 && fb(a2, !!c2.multiple, b2, false);
      }
    };
    Gb = Qk;
    Hb = Rk;
    var sl = { usingClientEntryPoint: false, Events: [Cb, ue2, Db, Eb, Fb, Qk] }, tl = { findFiberByHostInstance: Wc, bundleType: 0, version: "18.3.1", rendererPackageName: "react-dom" };
    var ul = { bundleType: tl.bundleType, version: tl.version, rendererPackageName: tl.rendererPackageName, rendererConfig: tl.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: ua.ReactCurrentDispatcher, findHostInstanceByFiber: function(a2) {
      a2 = Zb(a2);
      return null === a2 ? null : a2.stateNode;
    }, findFiberByHostInstance: tl.findFiberByHostInstance || jl, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1-next-f1338f8080-20240426" };
    if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
      var vl = __REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!vl.isDisabled && vl.supportsFiber) try {
        kc = vl.inject(ul), lc = vl;
      } catch (a2) {
      }
    }
    reactDom_production_min.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = sl;
    reactDom_production_min.createPortal = function(a2, b2) {
      var c2 = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
      if (!nl(b2)) throw Error(p2(200));
      return cl(a2, b2, null, c2);
    };
    reactDom_production_min.createRoot = function(a2, b2) {
      if (!nl(a2)) throw Error(p2(299));
      var c2 = false, d2 = "", e2 = kl;
      null !== b2 && void 0 !== b2 && (true === b2.unstable_strictMode && (c2 = true), void 0 !== b2.identifierPrefix && (d2 = b2.identifierPrefix), void 0 !== b2.onRecoverableError && (e2 = b2.onRecoverableError));
      b2 = bl(a2, 1, false, null, null, c2, false, d2, e2);
      a2[uf] = b2.current;
      sf(8 === a2.nodeType ? a2.parentNode : a2);
      return new ll(b2);
    };
    reactDom_production_min.findDOMNode = function(a2) {
      if (null == a2) return null;
      if (1 === a2.nodeType) return a2;
      var b2 = a2._reactInternals;
      if (void 0 === b2) {
        if ("function" === typeof a2.render) throw Error(p2(188));
        a2 = Object.keys(a2).join(",");
        throw Error(p2(268, a2));
      }
      a2 = Zb(b2);
      a2 = null === a2 ? null : a2.stateNode;
      return a2;
    };
    reactDom_production_min.flushSync = function(a2) {
      return Rk(a2);
    };
    reactDom_production_min.hydrate = function(a2, b2, c2) {
      if (!ol(b2)) throw Error(p2(200));
      return rl(null, a2, b2, true, c2);
    };
    reactDom_production_min.hydrateRoot = function(a2, b2, c2) {
      if (!nl(a2)) throw Error(p2(405));
      var d2 = null != c2 && c2.hydratedSources || null, e2 = false, f2 = "", g2 = kl;
      null !== c2 && void 0 !== c2 && (true === c2.unstable_strictMode && (e2 = true), void 0 !== c2.identifierPrefix && (f2 = c2.identifierPrefix), void 0 !== c2.onRecoverableError && (g2 = c2.onRecoverableError));
      b2 = el(b2, null, a2, 1, null != c2 ? c2 : null, e2, false, f2, g2);
      a2[uf] = b2.current;
      sf(a2);
      if (d2) for (a2 = 0; a2 < d2.length; a2++) c2 = d2[a2], e2 = c2._getVersion, e2 = e2(c2._source), null == b2.mutableSourceEagerHydrationData ? b2.mutableSourceEagerHydrationData = [c2, e2] : b2.mutableSourceEagerHydrationData.push(
        c2,
        e2
      );
      return new ml(b2);
    };
    reactDom_production_min.render = function(a2, b2, c2) {
      if (!ol(b2)) throw Error(p2(200));
      return rl(null, a2, b2, false, c2);
    };
    reactDom_production_min.unmountComponentAtNode = function(a2) {
      if (!ol(a2)) throw Error(p2(40));
      return a2._reactRootContainer ? (Rk(function() {
        rl(null, null, a2, false, function() {
          a2._reactRootContainer = null;
          a2[uf] = null;
        });
      }), true) : false;
    };
    reactDom_production_min.unstable_batchedUpdates = Qk;
    reactDom_production_min.unstable_renderSubtreeIntoContainer = function(a2, b2, c2, d2) {
      if (!ol(c2)) throw Error(p2(200));
      if (null == a2 || void 0 === a2._reactInternals) throw Error(p2(38));
      return rl(a2, b2, c2, false, d2);
    };
    reactDom_production_min.version = "18.3.1-next-f1338f8080-20240426";
    return reactDom_production_min;
  }
  var hasRequiredReactDom;
  function requireReactDom() {
    if (hasRequiredReactDom) return reactDom.exports;
    hasRequiredReactDom = 1;
    function checkDCE() {
      if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
        return;
      }
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
      } catch (err) {
        console.error(err);
      }
    }
    {
      checkDCE();
      reactDom.exports = requireReactDom_production_min();
    }
    return reactDom.exports;
  }
  var hasRequiredClient;
  function requireClient() {
    if (hasRequiredClient) return client;
    hasRequiredClient = 1;
    var m2 = requireReactDom();
    {
      client.createRoot = m2.createRoot;
      client.hydrateRoot = m2.hydrateRoot;
    }
    return client;
  }
  var clientExports = requireClient();
  var reactExports = requireReact();
  const DEFAULT_CONTENT = {
    version: "lexical_v1",
    editorState: null,
    legacyHtml: null,
    plainText: ""
  };
  function isJson(value) {
    return typeof value === "object" && value !== null;
  }
  function safeParseJson(value) {
    if (value == null) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value);
    } catch (e2) {
      return null;
    }
  }
  function stripHtml(html) {
    var _a;
    if (typeof DOMParser !== "undefined") {
      try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return ((_a = doc.body) == null ? void 0 : _a.textContent) || "";
      } catch (e2) {
      }
    }
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  function createPlainTextEditorState(text) {
    const paragraph = {
      children: text ? [
        {
          detail: 0,
          format: 0,
          mode: "normal",
          style: "",
          text,
          type: "text",
          version: 1
        }
      ] : [],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "paragraph",
      version: 1
    };
    return {
      root: {
        children: [paragraph],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1
      }
    };
  }
  function legacyHtmlToNoteContent(html) {
    const plainText = stripHtml(html);
    return {
      version: "lexical_v1",
      editorState: createPlainTextEditorState(plainText),
      legacyHtml: html,
      plainText
    };
  }
  function extractPlainTextFromEditorState(editorState) {
    try {
      const state = typeof editorState === "string" ? JSON.parse(editorState) : editorState;
      if (!isJson(state)) return "";
      const collectText = (node) => {
        if (!node) return "";
        if (typeof node.text === "string") return node.text;
        if (Array.isArray(node.children)) {
          return node.children.map(collectText).join(" ");
        }
        return "";
      };
      const root = state.root;
      if (!root) return "";
      const segments = Array.isArray(root.children) ? root.children.map(collectText).filter(Boolean) : [];
      return segments.join(" ").trim();
    } catch (e2) {
      return "";
    }
  }
  function normalizeContent(raw) {
    var _a;
    const editorVersion = (raw == null ? void 0 : raw.editor_version) || (raw == null ? void 0 : raw.editorVersion);
    const contentJson = safeParseJson((_a = raw == null ? void 0 : raw.content_json) != null ? _a : raw == null ? void 0 : raw.contentJson);
    const legacyContent = typeof (raw == null ? void 0 : raw.content) === "string" ? raw.content : void 0;
    if (contentJson) {
      return {
        version: editorVersion || "lexical_v1",
        editorState: contentJson,
        legacyHtml: legacyContent,
        plainText: (raw == null ? void 0 : raw.content_text) || (raw == null ? void 0 : raw.plain_text) || stripHtml(legacyContent || "")
      };
    }
    if (legacyContent) {
      return legacyHtmlToNoteContent(legacyContent);
    }
    return __spreadValues({}, DEFAULT_CONTENT);
  }
  function toDomainNote(raw) {
    var _a, _b, _c, _d, _e2, _f, _g, _h, _i2, _j, _k, _l, _m, _n2, _o;
    const content = normalizeContent(raw);
    const preview = (raw == null ? void 0 : raw.preview) || (raw == null ? void 0 : raw.content_text) || content.plainText || extractPlainTextFromEditorState(content.editorState);
    return {
      id: (_a = raw == null ? void 0 : raw.id) != null ? _a : null,
      title: (raw == null ? void 0 : raw.title) || "Untitled note",
      content,
      sourceUrl: (_c = (_b = raw == null ? void 0 : raw.source_url) != null ? _b : raw == null ? void 0 : raw.sourceUrl) != null ? _c : null,
      sourceSelection: (_e2 = (_d = raw == null ? void 0 : raw.source_selection) != null ? _d : raw == null ? void 0 : raw.sourceSelection) != null ? _e2 : null,
      courseCode: (_g = (_f = raw == null ? void 0 : raw.course_code) != null ? _f : raw == null ? void 0 : raw.courseCode) != null ? _g : null,
      noteType: (raw == null ? void 0 : raw.note_type) || (raw == null ? void 0 : raw.noteType) || "manual",
      tags: Array.isArray(raw == null ? void 0 : raw.tags) ? raw.tags : [],
      createdAt: (_i2 = (_h = raw == null ? void 0 : raw.created_at) != null ? _h : raw == null ? void 0 : raw.createdAt) != null ? _i2 : null,
      updatedAt: (_k = (_j = raw == null ? void 0 : raw.updated_at) != null ? _j : raw == null ? void 0 : raw.updatedAt) != null ? _k : null,
      linkedLabel: (_n2 = (_m = (_l = raw == null ? void 0 : raw.linked_label) != null ? _l : raw == null ? void 0 : raw.course_code) != null ? _m : raw == null ? void 0 : raw.courseCode) != null ? _n2 : void 0,
      isStarred: Boolean((_o = raw == null ? void 0 : raw.is_starred) != null ? _o : raw == null ? void 0 : raw.isStarred),
      previewText: preview || ""
    };
  }
  function toBackendPayload(content) {
    var _a, _b, _c, _d, _e2;
    if (!content) return {};
    const editorState = (_a = content.editorState) != null ? _a : createPlainTextEditorState(content.plainText || extractPlainTextFromEditorState(content.editorState) || "");
    const plainText = content.plainText || extractPlainTextFromEditorState(editorState) || null;
    if (content.version === "lexical_v1") {
      return {
        content_json: editorState,
        editor_version: "lexical_v1",
        // Keep legacy compatibility: send HTML/plain as a fallback field
        content: (_c = (_b = content.legacyHtml) != null ? _b : plainText) != null ? _c : "",
        content_text: plainText != null ? plainText : ""
      };
    }
    return {
      content_json: editorState,
      editor_version: content.version,
      content: (_e2 = (_d = content.legacyHtml) != null ? _d : plainText) != null ? _e2 : "",
      content_text: plainText != null ? plainText : ""
    };
  }
  function migrateLegacyNote(raw, apiClient) {
    return __async(this, null, function* () {
      var _a;
      if (!(raw == null ? void 0 : raw.id) || (raw == null ? void 0 : raw.content_json)) {
        return toDomainNote(raw);
      }
      if (typeof (raw == null ? void 0 : raw.content) !== "string") {
        return toDomainNote(raw);
      }
      const legacyContent = legacyHtmlToNoteContent(raw.content);
      const payload = __spreadValues({
        title: (_a = raw.title) != null ? _a : "Untitled note"
      }, toBackendPayload(legacyContent));
      try {
        const updated = yield apiClient.updateNote(raw.id, payload, void 0);
        return toDomainNote(updated);
      } catch (e2) {
        const augmentedRaw = __spreadProps(__spreadValues({}, raw), {
          content_json: payload.content_json,
          editor_version: payload.editor_version
        });
        return toDomainNote(augmentedRaw);
      }
    });
  }
  function ensureService(apiClient) {
    if (!apiClient) {
      throw new Error("Notes service requires an ApiClient instance");
    }
  }
  function createNotesService(apiClient) {
    function listNotes() {
      return __async(this, arguments, function* (params = {}) {
        var _a;
        ensureService(apiClient);
        const rawNotes = yield apiClient.listNotes({
          courseCode: params.courseCode || void 0,
          sourceUrl: params.sourceUrl || void 0,
          limit: (_a = params.limit) != null ? _a : 50
        });
        if (!Array.isArray(rawNotes)) return [];
        const migrated = yield Promise.all(
          rawNotes.map(
            (raw) => (raw == null ? void 0 : raw.content_json) ? Promise.resolve(toDomainNote(raw)) : migrateLegacyNote(raw, apiClient)
          )
        );
        return migrated;
      });
    }
    function getNote(noteId) {
      return __async(this, null, function* () {
        ensureService(apiClient);
        const raw = yield apiClient.apiRequest(`/api/notes/${noteId}`, {
          method: "GET"
        });
        if (!(raw == null ? void 0 : raw.content_json) && (raw == null ? void 0 : raw.content)) {
          return migrateLegacyNote(raw, apiClient);
        }
        return toDomainNote(raw);
      });
    }
    function createNote(initial) {
      return __async(this, null, function* () {
        var _a, _b, _c, _d, _e2, _f, _g, _h, _i2;
        ensureService(apiClient);
        const payload = __spreadValues({
          title: initial.title,
          sourceUrl: (_a = initial.sourceUrl) != null ? _a : null,
          source_url: (_b = initial.sourceUrl) != null ? _b : null,
          sourceSelection: (_c = initial.sourceSelection) != null ? _c : null,
          source_selection: (_d = initial.sourceSelection) != null ? _d : null,
          courseCode: (_e2 = initial.courseCode) != null ? _e2 : null,
          course_code: (_f = initial.courseCode) != null ? _f : null,
          noteType: (_g = initial.noteType) != null ? _g : "manual",
          note_type: (_h = initial.noteType) != null ? _h : "manual",
          tags: (_i2 = initial.tags) != null ? _i2 : []
        }, toBackendPayload(initial.content));
        const raw = yield apiClient.createNote(payload, void 0);
        return toDomainNote(raw);
      });
    }
    function updateNote(noteId, changes) {
      return __async(this, null, function* () {
        var _a, _b, _c, _d, _e2, _f, _g, _h, _i2;
        ensureService(apiClient);
        const payload = __spreadValues(__spreadProps(__spreadValues({}, changes.title ? { title: changes.title } : {}), {
          sourceUrl: (_a = changes.sourceUrl) != null ? _a : void 0,
          source_url: (_b = changes.sourceUrl) != null ? _b : void 0,
          sourceSelection: (_c = changes.sourceSelection) != null ? _c : void 0,
          source_selection: (_d = changes.sourceSelection) != null ? _d : void 0,
          courseCode: (_e2 = changes.courseCode) != null ? _e2 : void 0,
          course_code: (_f = changes.courseCode) != null ? _f : void 0,
          noteType: (_g = changes.noteType) != null ? _g : void 0,
          note_type: (_h = changes.noteType) != null ? _h : void 0,
          tags: (_i2 = changes.tags) != null ? _i2 : void 0
        }), toBackendPayload(changes.content));
        const raw = yield apiClient.updateNote(noteId, payload, void 0);
        return toDomainNote(raw);
      });
    }
    function deleteNote(noteId) {
      return __async(this, null, function* () {
        ensureService(apiClient);
        yield apiClient.deleteNote(noteId);
      });
    }
    function toggleStar(noteId) {
      return __async(this, null, function* () {
        ensureService(apiClient);
        if (!noteId) {
          throw new Error("Note ID is required to toggle star");
        }
        if (typeof apiClient.toggleNoteStar !== "function") {
          const error = new Error(
            "API client is missing toggleNoteStar method. Please rebuild initApi.js or check your API client initialization."
          );
          error.code = "API_CLIENT_ERROR";
          console.error("[NotesService] toggleStar failed:", error.message);
          console.error("[NotesService] Available API client methods:", Object.keys(apiClient));
          throw error;
        }
        try {
          const raw = yield apiClient.toggleNoteStar(noteId);
          return toDomainNote(raw);
        } catch (error) {
          console.error("[NotesService] toggleStar failed:", (error == null ? void 0 : error.message) || error);
          throw error;
        }
      });
    }
    function setStar(noteId, isStarred) {
      return __async(this, null, function* () {
        ensureService(apiClient);
        const raw = yield apiClient.setNoteStar(noteId, isStarred);
        return toDomainNote(raw);
      });
    }
    function listAssets(noteId) {
      return __async(this, null, function* () {
        ensureService(apiClient);
        return apiClient.listNoteAssets({ noteId });
      });
    }
    function uploadAsset(noteId, file) {
      return __async(this, null, function* () {
        ensureService(apiClient);
        return apiClient.uploadNoteAsset({ noteId, file });
      });
    }
    function deleteAsset(assetId) {
      return __async(this, null, function* () {
        ensureService(apiClient);
        return apiClient.deleteNoteAsset({ assetId });
      });
    }
    return {
      listNotes,
      getNote,
      createNote,
      updateNote,
      deleteNote,
      toggleStar,
      setStar,
      listAssets,
      uploadAsset,
      deleteAsset
    };
  }
  function useNotesList(options) {
    const { notesService, limit = 50 } = options;
    const [notes, setNotes] = reactExports.useState([]);
    const [isLoading, setIsLoading] = reactExports.useState(false);
    const [error, setError] = reactExports.useState(null);
    const isRefreshingRef = reactExports.useRef(false);
    const lastParamsRef = reactExports.useRef("");
    const refresh = reactExports.useCallback(() => __async(null, null, function* () {
      if (!notesService) return;
      const paramsFingerprint = JSON.stringify({ limit });
      if (isRefreshingRef.current && lastParamsRef.current === paramsFingerprint) {
        return;
      }
      isRefreshingRef.current = true;
      lastParamsRef.current = paramsFingerprint;
      setIsLoading(true);
      setError(null);
      try {
        const list = yield notesService.listNotes({
          limit
        });
        setNotes(list);
      } catch (err) {
        setError((err == null ? void 0 : err.message) || "Failed to load notes");
      } finally {
        setIsLoading(false);
        isRefreshingRef.current = false;
      }
    }), [limit, notesService]);
    const upsertNote = reactExports.useCallback((note) => {
      setNotes((prev) => {
        const filtered = prev.filter((item) => item.id !== note.id);
        return [note, ...filtered];
      });
    }, []);
    const deleteNote = reactExports.useCallback((noteId) => __async(null, null, function* () {
      if (!notesService || !noteId) return;
      let deletedNote;
      let deletedIndex = -1;
      setNotes((prev) => {
        deletedIndex = prev.findIndex((n2) => n2.id === noteId);
        if (deletedIndex >= 0) {
          deletedNote = prev[deletedIndex];
        }
        return prev.filter((n2) => n2.id !== noteId);
      });
      try {
        yield notesService.deleteNote(noteId);
      } catch (err) {
        if (deletedNote) {
          setNotes((prev) => {
            const newList = [...prev];
            if (deletedIndex >= 0 && deletedIndex <= newList.length) {
              newList.splice(deletedIndex, 0, deletedNote);
            } else {
              newList.unshift(deletedNote);
            }
            return newList;
          });
        }
        setError((err == null ? void 0 : err.message) || "Failed to delete note");
        throw err;
      }
    }), [notesService]);
    const toggleStar = reactExports.useCallback((noteId) => __async(null, null, function* () {
      if (!notesService) {
        const error2 = new Error("Notes service not available. Please try again.");
        setError(error2.message);
        throw error2;
      }
      if (!noteId) {
        const error2 = new Error("Cannot star note: Note ID is missing");
        setError(error2.message);
        throw error2;
      }
      let originalNote;
      setNotes((prev) => {
        return prev.map((n2) => {
          if (n2.id === noteId) {
            originalNote = n2;
            return __spreadProps(__spreadValues({}, n2), { isStarred: !n2.isStarred });
          }
          return n2;
        });
      });
      try {
        const updated = yield notesService.toggleStar(noteId);
        setNotes((prev) => prev.map((n2) => n2.id === noteId ? updated : n2));
        return updated;
      } catch (err) {
        if (originalNote) {
          setNotes((prev) => prev.map((n2) => n2.id === noteId ? originalNote : n2));
        }
        let errorMessage = "Failed to toggle star";
        if ((err == null ? void 0 : err.code) === "AUTH_REQUIRED") {
          errorMessage = "Please sign in to star notes";
        } else if ((err == null ? void 0 : err.code) === "NOT_FOUND") {
          errorMessage = "Note not found";
        } else if ((err == null ? void 0 : err.code) === "NETWORK_ERROR") {
          errorMessage = "Network error. Please check your connection.";
        } else if (err == null ? void 0 : err.message) {
          errorMessage = err.message;
        }
        setError(errorMessage);
        throw err;
      }
    }), [notesService]);
    const removeFromList = reactExports.useCallback((noteId) => {
      setNotes((prev) => prev.filter((n2) => n2.id !== noteId));
    }, []);
    reactExports.useEffect(() => {
      refresh();
    }, [refresh]);
    return {
      notes,
      isLoading,
      error,
      refresh,
      upsertNote,
      deleteNote,
      toggleStar,
      removeFromList
    };
  }
  const toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const toCamelCase = (string) => string.replace(
    /^([A-Z])|[\s-_]+(\w)/g,
    (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase()
  );
  const toPascalCase = (string) => {
    const camelCase = toCamelCase(string);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  };
  const mergeClasses = (...classes) => classes.filter((className, index, array) => {
    return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
  }).join(" ").trim();
  const hasA11yProp = (props) => {
    for (const prop in props) {
      if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
        return true;
      }
    }
  };
  var defaultAttributes = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };
  const Icon = reactExports.forwardRef(
    (_a, ref) => {
      var _b = _a, {
        color = "currentColor",
        size = 24,
        strokeWidth = 2,
        absoluteStrokeWidth,
        className = "",
        children,
        iconNode
      } = _b, rest = __objRest(_b, [
        "color",
        "size",
        "strokeWidth",
        "absoluteStrokeWidth",
        "className",
        "children",
        "iconNode"
      ]);
      return reactExports.createElement(
        "svg",
        __spreadValues(__spreadValues(__spreadProps(__spreadValues({
          ref
        }, defaultAttributes), {
          width: size,
          height: size,
          stroke: color,
          strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
          className: mergeClasses("lucide", className)
        }), !children && !hasA11yProp(rest) && { "aria-hidden": "true" }), rest),
        [
          ...iconNode.map(([tag, attrs]) => reactExports.createElement(tag, attrs)),
          ...Array.isArray(children) ? children : [children]
        ]
      );
    }
  );
  const createLucideIcon = (iconName, iconNode) => {
    const Component = reactExports.forwardRef(
      (_a, ref) => {
        var _b = _a, { className } = _b, props = __objRest(_b, ["className"]);
        return reactExports.createElement(Icon, __spreadValues({
          ref,
          iconNode,
          className: mergeClasses(
            `lucide-${toKebabCase(toPascalCase(iconName))}`,
            `lucide-${iconName}`,
            className
          )
        }, props));
      }
    );
    Component.displayName = toPascalCase(iconName);
    return Component;
  };
  const __iconNode$l = [
    [
      "path",
      { d: "M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8", key: "mg9rjx" }
    ]
  ];
  const Bold = createLucideIcon("bold", __iconNode$l);
  const __iconNode$k = [
    [
      "path",
      { d: "M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1", key: "ezmyqa" }
    ],
    [
      "path",
      {
        d: "M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1",
        key: "e1hn23"
      }
    ]
  ];
  const Braces = createLucideIcon("braces", __iconNode$k);
  const __iconNode$j = [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]];
  const Check = createLucideIcon("check", __iconNode$j);
  const __iconNode$i = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
    ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }]
  ];
  const CircleAlert = createLucideIcon("circle-alert", __iconNode$i);
  const __iconNode$h = [
    ["path", { d: "m16 18 6-6-6-6", key: "eg8j8" }],
    ["path", { d: "m8 6-6 6 6 6", key: "ppft3o" }]
  ];
  const Code = createLucideIcon("code", __iconNode$h);
  const __iconNode$g = [
    ["path", { d: "m9 11-6 6v3h9l3-3", key: "1a3l36" }],
    ["path", { d: "m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4", key: "14a9rk" }]
  ];
  const Highlighter = createLucideIcon("highlighter", __iconNode$g);
  const __iconNode$f = [
    ["line", { x1: "19", x2: "10", y1: "4", y2: "4", key: "15jd3p" }],
    ["line", { x1: "14", x2: "5", y1: "20", y2: "20", key: "bu0au3" }],
    ["line", { x1: "15", x2: "9", y1: "4", y2: "20", key: "uljnxc" }]
  ];
  const Italic = createLucideIcon("italic", __iconNode$f);
  const __iconNode$e = [
    ["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", key: "1cjeqo" }],
    ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71", key: "19qd67" }]
  ];
  const Link = createLucideIcon("link", __iconNode$e);
  const __iconNode$d = [
    ["path", { d: "M11 5h10", key: "1cz7ny" }],
    ["path", { d: "M11 12h10", key: "1438ji" }],
    ["path", { d: "M11 19h10", key: "11t30w" }],
    ["path", { d: "M4 4h1v5", key: "10yrso" }],
    ["path", { d: "M4 9h2", key: "r1h2o0" }],
    ["path", { d: "M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02", key: "xtkcd5" }]
  ];
  const ListOrdered = createLucideIcon("list-ordered", __iconNode$d);
  const __iconNode$c = [
    ["path", { d: "M3 5h.01", key: "18ugdj" }],
    ["path", { d: "M3 12h.01", key: "nlz23k" }],
    ["path", { d: "M3 19h.01", key: "noohij" }],
    ["path", { d: "M8 5h13", key: "1pao27" }],
    ["path", { d: "M8 12h13", key: "1za7za" }],
    ["path", { d: "M8 19h13", key: "m83p4d" }]
  ];
  const List = createLucideIcon("list", __iconNode$c);
  const __iconNode$b = [
    [
      "path",
      {
        d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",
        key: "e79jfc"
      }
    ],
    ["circle", { cx: "13.5", cy: "6.5", r: ".5", fill: "currentColor", key: "1okk4w" }],
    ["circle", { cx: "17.5", cy: "10.5", r: ".5", fill: "currentColor", key: "f64h9f" }],
    ["circle", { cx: "6.5", cy: "12.5", r: ".5", fill: "currentColor", key: "qy21gx" }],
    ["circle", { cx: "8.5", cy: "7.5", r: ".5", fill: "currentColor", key: "fotxhn" }]
  ];
  const Palette = createLucideIcon("palette", __iconNode$b);
  const __iconNode$a = [
    [
      "path",
      {
        d: "m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551",
        key: "1miecu"
      }
    ]
  ];
  const Paperclip = createLucideIcon("paperclip", __iconNode$a);
  const __iconNode$9 = [
    ["path", { d: "m15 14 5-5-5-5", key: "12vg1m" }],
    ["path", { d: "M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13", key: "6uklza" }]
  ];
  const Redo2 = createLucideIcon("redo-2", __iconNode$9);
  const __iconNode$8 = [
    [
      "path",
      {
        d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
        key: "r04s7s"
      }
    ]
  ];
  const Star = createLucideIcon("star", __iconNode$8);
  const __iconNode$7 = [
    ["path", { d: "M21 5H3", key: "1fi0y6" }],
    ["path", { d: "M17 12H7", key: "16if0g" }],
    ["path", { d: "M19 19H5", key: "vjpgq2" }]
  ];
  const TextAlignCenter = createLucideIcon("text-align-center", __iconNode$7);
  const __iconNode$6 = [
    ["path", { d: "M21 5H3", key: "1fi0y6" }],
    ["path", { d: "M21 12H9", key: "dn1m92" }],
    ["path", { d: "M21 19H7", key: "4cu937" }]
  ];
  const TextAlignEnd = createLucideIcon("text-align-end", __iconNode$6);
  const __iconNode$5 = [
    ["path", { d: "M21 5H3", key: "1fi0y6" }],
    ["path", { d: "M15 12H3", key: "6jk70r" }],
    ["path", { d: "M17 19H3", key: "z6ezky" }]
  ];
  const TextAlignStart = createLucideIcon("text-align-start", __iconNode$5);
  const __iconNode$4 = [
    ["path", { d: "M10 11v6", key: "nco0om" }],
    ["path", { d: "M14 11v6", key: "outv1u" }],
    ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", key: "miytrc" }],
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", key: "e791ji" }]
  ];
  const Trash2 = createLucideIcon("trash-2", __iconNode$4);
  const __iconNode$3 = [
    [
      "path",
      {
        d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
        key: "wmoenq"
      }
    ],
    ["path", { d: "M12 9v4", key: "juzpu7" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ];
  const TriangleAlert = createLucideIcon("triangle-alert", __iconNode$3);
  const __iconNode$2 = [
    ["path", { d: "M6 4v6a6 6 0 0 0 12 0V4", key: "9kb039" }],
    ["line", { x1: "4", x2: "20", y1: "20", y2: "20", key: "nun2al" }]
  ];
  const Underline = createLucideIcon("underline", __iconNode$2);
  const __iconNode$1 = [
    ["path", { d: "M9 14 4 9l5-5", key: "102s5s" }],
    ["path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11", key: "f3b9sd" }]
  ];
  const Undo2 = createLucideIcon("undo-2", __iconNode$1);
  const __iconNode = [
    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
    ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
  ];
  const X$2 = createLucideIcon("x", __iconNode);
  function useNoteAssets(noteId, notesService) {
    const [noteAssets, setNoteAssets] = reactExports.useState([]);
    const [isLoading, setIsLoading] = reactExports.useState(false);
    const [isUploading, setIsUploading] = reactExports.useState(false);
    const [error, setError] = reactExports.useState(null);
    const loadingNoteIdRef = reactExports.useRef(null);
    const loadAssets = reactExports.useCallback(() => __async(null, null, function* () {
      if (!noteId || !(notesService == null ? void 0 : notesService.listAssets)) {
        setNoteAssets([]);
        setIsLoading(false);
        return;
      }
      if (loadingNoteIdRef.current === noteId) {
        return;
      }
      loadingNoteIdRef.current = noteId;
      setIsLoading(true);
      setError(null);
      setNoteAssets([]);
      try {
        const assets = yield notesService.listAssets(noteId);
        if (loadingNoteIdRef.current === noteId) {
          setNoteAssets(Array.isArray(assets) ? assets : []);
        }
      } catch (err) {
        if (loadingNoteIdRef.current === noteId) {
          setError((err == null ? void 0 : err.message) || "Failed to load attachments");
        }
      } finally {
        if (loadingNoteIdRef.current === noteId) {
          setIsLoading(false);
          loadingNoteIdRef.current = null;
        }
      }
    }), [noteId, notesService]);
    const uploadAsset = reactExports.useCallback(
      (file) => __async(null, null, function* () {
        if (!noteId) {
          setError("Save the note before adding attachments.");
          return null;
        }
        if (!(notesService == null ? void 0 : notesService.uploadAsset)) {
          setError("Upload is not available.");
          return null;
        }
        setIsUploading(true);
        setError(null);
        try {
          const asset = yield notesService.uploadAsset(noteId, file);
          setNoteAssets((prev) => [...prev, asset]);
          return asset;
        } catch (err) {
          setError((err == null ? void 0 : err.message) || "Failed to upload attachment");
          return null;
        } finally {
          setIsUploading(false);
        }
      }),
      [noteId, notesService]
    );
    const deleteAsset = reactExports.useCallback(
      (assetId) => __async(null, null, function* () {
        if (!(notesService == null ? void 0 : notesService.deleteAsset)) {
          setError("Delete is not available.");
          return false;
        }
        try {
          yield notesService.deleteAsset(assetId);
          setNoteAssets((prev) => prev.filter((asset) => asset.id !== assetId));
          return true;
        } catch (err) {
          setError((err == null ? void 0 : err.message) || "Failed to delete attachment");
          return false;
        }
      }),
      [notesService]
    );
    return {
      noteAssets,
      isLoading,
      isUploading,
      error,
      uploadAsset,
      deleteAsset,
      reloadAssets: loadAssets
    };
  }
  const SAVE_DEBOUNCE_MS = 1500;
  const SAVED_RESET_DELAY_MS = 1200;
  const MAX_SAVE_RETRIES = 3;
  const OFFLINE_QUEUE_KEY = "lockin_offline_notes_queue";
  function loadOfflineQueue() {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (e2) {
      return [];
    }
  }
  function saveOfflineQueue(queue) {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (e2) {
      console.error("[NoteEditor] Failed to save offline queue");
    }
  }
  function addToOfflineQueue(save) {
    const queue = loadOfflineQueue();
    const filtered = queue.filter(
      (s2) => s2.noteId !== save.noteId || s2.noteId === null && save.noteId === null && s2.timestamp !== save.timestamp
    );
    filtered.push(save);
    const trimmed = filtered.slice(-50);
    saveOfflineQueue(trimmed);
  }
  function removeFromOfflineQueue(noteId, timestamp) {
    const queue = loadOfflineQueue();
    const filtered = queue.filter(
      (s2) => !(s2.noteId === noteId && s2.timestamp === timestamp)
    );
    saveOfflineQueue(filtered);
  }
  function createDraftNote(opts) {
    var _a, _b, _c, _d;
    return {
      id: null,
      title: "",
      content: {
        version: "lexical_v1",
        editorState: null,
        legacyHtml: null,
        plainText: ""
      },
      sourceUrl: (_a = opts.sourceUrl) != null ? _a : null,
      sourceSelection: (_b = opts.sourceSelection) != null ? _b : null,
      courseCode: (_c = opts.courseCode) != null ? _c : null,
      noteType: "manual",
      tags: [],
      createdAt: null,
      updatedAt: null,
      linkedLabel: (_d = opts.courseCode) != null ? _d : void 0,
      isStarred: false,
      previewText: ""
    };
  }
  function createContentFingerprint(title, content) {
    return JSON.stringify({
      title: title.trim(),
      content: content.editorState,
      version: content.version,
      legacy: content.legacyHtml,
      plainText: content.plainText
    });
  }
  function useNoteEditor(options) {
    const { notesService, noteId, defaultCourseCode, defaultSourceUrl, sourceSelection } = options;
    const [activeNoteId, setActiveNoteId] = reactExports.useState(noteId != null ? noteId : null);
    const [note, setNote] = reactExports.useState(
      createDraftNote({ courseCode: defaultCourseCode, sourceUrl: defaultSourceUrl, sourceSelection })
    );
    const [status, setStatus] = reactExports.useState("idle");
    const [error, setError] = reactExports.useState(null);
    const [isLoading, setIsLoading] = reactExports.useState(false);
    const debounceRef = reactExports.useRef(null);
    const savedResetRef = reactExports.useRef(null);
    const abortControllerRef = reactExports.useRef(null);
    const lastSavedFingerprintRef = reactExports.useRef(null);
    const loadingNoteIdRef = reactExports.useRef(null);
    const lastLoadedNoteIdRef = reactExports.useRef(null);
    reactExports.useEffect(() => {
      setActiveNoteId(noteId != null ? noteId : null);
    }, [noteId]);
    reactExports.useEffect(() => {
      return () => {
        if (debounceRef.current) {
          window.clearTimeout(debounceRef.current);
        }
        if (savedResetRef.current) {
          window.clearTimeout(savedResetRef.current);
        }
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, []);
    const notesServiceRef = reactExports.useRef(notesService);
    notesServiceRef.current = notesService;
    const defaultCourseCodeRef = reactExports.useRef(defaultCourseCode);
    defaultCourseCodeRef.current = defaultCourseCode;
    const defaultSourceUrlRef = reactExports.useRef(defaultSourceUrl);
    defaultSourceUrlRef.current = defaultSourceUrl;
    const sourceSelectionRef = reactExports.useRef(sourceSelection);
    sourceSelectionRef.current = sourceSelection;
    reactExports.useEffect(() => {
      const targetId = activeNoteId;
      const service = notesServiceRef.current;
      if (targetId === loadingNoteIdRef.current) {
        return;
      }
      if (targetId === lastLoadedNoteIdRef.current && targetId !== null) {
        return;
      }
      if (!targetId || !service) {
        loadingNoteIdRef.current = null;
        lastLoadedNoteIdRef.current = null;
        const draft = createDraftNote({
          courseCode: defaultCourseCodeRef.current,
          sourceUrl: defaultSourceUrlRef.current,
          sourceSelection: sourceSelectionRef.current
        });
        setNote(draft);
        lastSavedFingerprintRef.current = createContentFingerprint(draft.title, draft.content);
        setStatus("idle");
        setIsLoading(false);
        return;
      }
      loadingNoteIdRef.current = targetId;
      setIsLoading(true);
      setError(null);
      let cancelled = false;
      (() => __async(null, null, function* () {
        try {
          const loaded = yield service.getNote(targetId);
          if (cancelled) return;
          setNote(loaded);
          lastSavedFingerprintRef.current = createContentFingerprint(
            loaded.title,
            loaded.content
          );
          lastLoadedNoteIdRef.current = targetId;
          setStatus("idle");
        } catch (err) {
          if (cancelled) return;
          setError((err == null ? void 0 : err.message) || "Failed to load note");
          setStatus("error");
        } finally {
          if (!cancelled) {
            loadingNoteIdRef.current = null;
            setIsLoading(false);
          }
        }
      }))();
      return () => {
        cancelled = true;
      };
    }, [activeNoteId]);
    const noteRef = reactExports.useRef(note);
    noteRef.current = note;
    const [pendingSaveCount, setPendingSaveCount] = reactExports.useState(() => loadOfflineQueue().length);
    const persist = reactExports.useCallback(() => __async(null, null, function* () {
      var _a, _b, _c, _d, _e2, _f, _g, _h, _i2, _j, _k, _l, _m, _n2, _o, _p, _q, _r2;
      const currentNote = noteRef.current;
      if (!notesService || !currentNote) {
        setError("Notes service unavailable");
        setStatus("error");
        return;
      }
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const fingerprint = createContentFingerprint(currentNote.title, currentNote.content);
      if (fingerprint === lastSavedFingerprintRef.current) {
        setStatus("saved");
        if (savedResetRef.current) {
          window.clearTimeout(savedResetRef.current);
        }
        savedResetRef.current = window.setTimeout(() => setStatus("idle"), SAVED_RESET_DELAY_MS);
        return;
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setStatus("saving");
      setError(null);
      const pendingSave = {
        noteId: currentNote.id,
        title: currentNote.title || "Untitled note",
        content: currentNote.content,
        courseCode: (_b = (_a = currentNote.courseCode) != null ? _a : defaultCourseCode) != null ? _b : null,
        sourceUrl: (_d = (_c = currentNote.sourceUrl) != null ? _c : defaultSourceUrl) != null ? _d : null,
        sourceSelection: (_f = (_e2 = currentNote.sourceSelection) != null ? _e2 : sourceSelection) != null ? _f : null,
        noteType: currentNote.noteType,
        tags: currentNote.tags,
        timestamp: Date.now(),
        retryCount: 0
      };
      try {
        let saved;
        if (currentNote.id) {
          const payload = {
            title: currentNote.title,
            content: currentNote.content,
            courseCode: (_h = (_g = currentNote.courseCode) != null ? _g : defaultCourseCode) != null ? _h : null,
            sourceUrl: (_j = (_i2 = currentNote.sourceUrl) != null ? _i2 : defaultSourceUrl) != null ? _j : null,
            sourceSelection: (_l = (_k = currentNote.sourceSelection) != null ? _k : sourceSelection) != null ? _l : null,
            noteType: currentNote.noteType,
            tags: currentNote.tags
          };
          saved = yield notesService.updateNote(currentNote.id, payload);
        } else {
          const payload = {
            title: currentNote.title || "Untitled note",
            content: currentNote.content,
            courseCode: (_n2 = (_m = currentNote.courseCode) != null ? _m : defaultCourseCode) != null ? _n2 : null,
            sourceUrl: (_p = (_o = currentNote.sourceUrl) != null ? _o : defaultSourceUrl) != null ? _p : null,
            sourceSelection: (_r2 = (_q = currentNote.sourceSelection) != null ? _q : sourceSelection) != null ? _r2 : null,
            noteType: currentNote.noteType,
            tags: currentNote.tags
          };
          saved = yield notesService.createNote(payload);
        }
        if (controller.signal.aborted) return;
        setNote(saved);
        setActiveNoteId(saved.id);
        lastSavedFingerprintRef.current = createContentFingerprint(
          saved.title,
          saved.content
        );
        setStatus("saved");
        if (savedResetRef.current) {
          window.clearTimeout(savedResetRef.current);
        }
        savedResetRef.current = window.setTimeout(() => setStatus("idle"), SAVED_RESET_DELAY_MS);
      } catch (err) {
        if (controller.signal.aborted) return;
        const isNetworkError = (err == null ? void 0 : err.code) === "NETWORK_ERROR" || !navigator.onLine;
        const isRetryable = isNetworkError || (err == null ? void 0 : err.code) === "RATE_LIMIT" || (err == null ? void 0 : err.status) === 429 || (err == null ? void 0 : err.status) >= 500;
        if (isRetryable && pendingSave.retryCount < MAX_SAVE_RETRIES) {
          addToOfflineQueue(pendingSave);
          setPendingSaveCount(loadOfflineQueue().length);
          setError(isNetworkError ? "Saved offline - will sync when connected" : "Save queued for retry");
          setStatus("error");
        } else {
          setError((err == null ? void 0 : err.message) || "Failed to save note");
          setStatus("error");
        }
      }
    }), [defaultCourseCode, defaultSourceUrl, notesService, sourceSelection]);
    const scheduleSave = reactExports.useCallback(() => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        void persist();
      }, SAVE_DEBOUNCE_MS);
    }, [persist]);
    const handleContentChange = reactExports.useCallback(
      (content) => {
        setNote((prev) => {
          const base = prev != null ? prev : createDraftNote({
            courseCode: defaultCourseCode,
            sourceUrl: defaultSourceUrl,
            sourceSelection
          });
          return __spreadProps(__spreadValues({}, base), { content });
        });
        setStatus("editing");
        scheduleSave();
      },
      [defaultCourseCode, defaultSourceUrl, scheduleSave, sourceSelection]
    );
    const handleTitleChange = reactExports.useCallback(
      (title) => {
        setNote((prev) => {
          const base = prev != null ? prev : createDraftNote({
            courseCode: defaultCourseCode,
            sourceUrl: defaultSourceUrl,
            sourceSelection
          });
          return __spreadProps(__spreadValues({}, base), { title });
        });
        setStatus("editing");
        scheduleSave();
      },
      [defaultCourseCode, defaultSourceUrl, scheduleSave, sourceSelection]
    );
    const saveNow = reactExports.useCallback(() => __async(null, null, function* () {
      yield persist();
    }), [persist]);
    const resetToNew = reactExports.useCallback(() => {
      var _a;
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      (_a = abortControllerRef.current) == null ? void 0 : _a.abort();
      setActiveNoteId(null);
      const draft = createDraftNote({
        courseCode: defaultCourseCode,
        sourceUrl: defaultSourceUrl,
        sourceSelection
      });
      setNote(draft);
      lastSavedFingerprintRef.current = null;
      setStatus("idle");
      setError(null);
    }, [defaultCourseCode, defaultSourceUrl, sourceSelection]);
    const syncOfflineQueue = reactExports.useCallback(() => __async(null, null, function* () {
      if (!notesService) return;
      const queue = loadOfflineQueue();
      if (queue.length === 0) return;
      console.log(`[NoteEditor] Syncing ${queue.length} offline saves`);
      for (const pendingSave of queue) {
        try {
          if (pendingSave.noteId) {
            const payload = {
              title: pendingSave.title,
              content: pendingSave.content,
              courseCode: pendingSave.courseCode,
              sourceUrl: pendingSave.sourceUrl,
              sourceSelection: pendingSave.sourceSelection,
              noteType: pendingSave.noteType,
              tags: pendingSave.tags
            };
            yield notesService.updateNote(pendingSave.noteId, payload);
          } else {
            const payload = {
              title: pendingSave.title,
              content: pendingSave.content,
              courseCode: pendingSave.courseCode,
              sourceUrl: pendingSave.sourceUrl,
              sourceSelection: pendingSave.sourceSelection,
              noteType: pendingSave.noteType,
              tags: pendingSave.tags
            };
            yield notesService.createNote(payload);
          }
          removeFromOfflineQueue(pendingSave.noteId, pendingSave.timestamp);
          console.log(`[NoteEditor] Synced offline save for note ${pendingSave.noteId || "new"}`);
        } catch (err) {
          console.error(`[NoteEditor] Failed to sync offline save:`, err);
          const queue2 = loadOfflineQueue();
          const updated = queue2.map(
            (s2) => s2.noteId === pendingSave.noteId && s2.timestamp === pendingSave.timestamp ? __spreadProps(__spreadValues({}, s2), { retryCount: s2.retryCount + 1 }) : s2
          );
          const filtered = updated.filter((s2) => s2.retryCount < MAX_SAVE_RETRIES);
          saveOfflineQueue(filtered);
        }
      }
      setPendingSaveCount(loadOfflineQueue().length);
    }), [notesService]);
    reactExports.useEffect(() => {
      const handleOnline = () => {
        console.log("[NoteEditor] Back online - syncing offline queue");
        void syncOfflineQueue();
      };
      window.addEventListener("online", handleOnline);
      return () => window.removeEventListener("online", handleOnline);
    }, [syncOfflineQueue]);
    return {
      note,
      status,
      error,
      isLoading,
      activeNoteId,
      pendingSaveCount,
      setActiveNoteId,
      handleContentChange,
      handleTitleChange,
      saveNow,
      resetToNew,
      syncOfflineQueue
    };
  }
  function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "default",
    isLoading = false
  }) {
    const dialogRef = reactExports.useRef(null);
    const cancelButtonRef = reactExports.useRef(null);
    reactExports.useEffect(() => {
      if (isOpen) {
        const timer = setTimeout(() => {
          var _a;
          (_a = cancelButtonRef.current) == null ? void 0 : _a.focus();
        }, 50);
        return () => clearTimeout(timer);
      }
    }, [isOpen]);
    reactExports.useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (e2) => {
        if (e2.key === "Escape" && !isLoading) {
          onClose();
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isLoading, onClose]);
    reactExports.useEffect(() => {
      if (isOpen) {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
          document.body.style.overflow = originalOverflow;
        };
      }
    }, [isOpen]);
    const handleBackdropClick = reactExports.useCallback(
      (e2) => {
        if (e2.target === e2.currentTarget && !isLoading) {
          onClose();
        }
      },
      [isLoading, onClose]
    );
    const handleConfirm = reactExports.useCallback(() => {
      if (!isLoading) {
        onConfirm();
      }
    }, [isLoading, onConfirm]);
    if (!isOpen) return null;
    const isDanger = variant === "danger";
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "lockin-confirm-backdrop",
        onClick: handleBackdropClick,
        role: "presentation",
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            ref: dialogRef,
            className: "lockin-confirm-dialog",
            role: "alertdialog",
            "aria-modal": "true",
            "aria-labelledby": "confirm-dialog-title",
            "aria-describedby": "confirm-dialog-description",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-confirm-header", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `lockin-confirm-icon ${isDanger ? "is-danger" : ""}`, children: /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { size: 24, strokeWidth: 2 }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    type: "button",
                    className: "lockin-confirm-close",
                    onClick: onClose,
                    disabled: isLoading,
                    "aria-label": "Close dialog",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(X$2, { size: 18, strokeWidth: 2 })
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-confirm-content", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { id: "confirm-dialog-title", className: "lockin-confirm-title", children: title }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "p",
                  {
                    id: "confirm-dialog-description",
                    className: "lockin-confirm-description",
                    children: description
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-confirm-actions", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    ref: cancelButtonRef,
                    type: "button",
                    className: "lockin-confirm-btn lockin-confirm-btn-cancel",
                    onClick: onClose,
                    disabled: isLoading,
                    children: cancelLabel
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    type: "button",
                    className: `lockin-confirm-btn ${isDanger ? "lockin-confirm-btn-danger" : "lockin-confirm-btn-primary"}`,
                    onClick: handleConfirm,
                    disabled: isLoading,
                    children: isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-confirm-spinner", "aria-hidden": "true" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Deleting..." })
                    ] }) : confirmLabel
                  }
                )
              ] })
            ]
          }
        )
      }
    );
  }
  const ICON_MAP = {
    success: Check,
    error: CircleAlert,
    info: CircleAlert,
    star: Star
  };
  function Toast({
    message,
    type = "info",
    duration = 3e3,
    onDismiss,
    isVisible
  }) {
    const [isLeaving, setIsLeaving] = reactExports.useState(false);
    reactExports.useEffect(() => {
      if (!isVisible || duration === 0) return;
      const timer = setTimeout(() => {
        setIsLeaving(true);
        setTimeout(onDismiss, 200);
      }, duration);
      return () => clearTimeout(timer);
    }, [isVisible, duration, onDismiss]);
    const handleDismiss = () => {
      setIsLeaving(true);
      setTimeout(onDismiss, 200);
    };
    if (!isVisible) return null;
    const Icon2 = ICON_MAP[type];
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: `lockin-toast lockin-toast-${type} ${isLeaving ? "is-leaving" : ""}`,
        role: "alert",
        "aria-live": "polite",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-toast-icon", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Icon2, { size: 16, strokeWidth: 2.5 }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-toast-message", children: message }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: "lockin-toast-dismiss",
              onClick: handleDismiss,
              "aria-label": "Dismiss notification",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(X$2, { size: 14, strokeWidth: 2 })
            }
          )
        ]
      }
    );
  }
  function useToast() {
    const [toast, setToast] = reactExports.useState(null);
    const showToast = (message, type = "info") => {
      setToast({ message, type, isVisible: true });
    };
    const hideToast = () => {
      setToast(null);
    };
    return {
      toast,
      showToast,
      hideToast
    };
  }
  var prism = { exports: {} };
  var hasRequiredPrism;
  function requirePrism() {
    if (hasRequiredPrism) return prism.exports;
    hasRequiredPrism = 1;
    (function(module) {
      var _self = typeof window !== "undefined" ? window : typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope ? self : {};
      var Prism2 = (function(_self2) {
        var lang = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i;
        var uniqueId = 0;
        var plainTextGrammar = {};
        var _2 = {
          /**
           * By default, Prism will attempt to highlight all code elements (by calling {@link Prism.highlightAll}) on the
           * current page after the page finished loading. This might be a problem if e.g. you wanted to asynchronously load
           * additional languages or plugins yourself.
           *
           * By setting this value to `true`, Prism will not automatically highlight all code elements on the page.
           *
           * You obviously have to change this value before the automatic highlighting started. To do this, you can add an
           * empty Prism object into the global scope before loading the Prism script like this:
           *
           * ```js
           * window.Prism = window.Prism || {};
           * Prism.manual = true;
           * // add a new <script> to load Prism's script
           * ```
           *
           * @default false
           * @type {boolean}
           * @memberof Prism
           * @public
           */
          manual: _self2.Prism && _self2.Prism.manual,
          /**
           * By default, if Prism is in a web worker, it assumes that it is in a worker it created itself, so it uses
           * `addEventListener` to communicate with its parent instance. However, if you're using Prism manually in your
           * own worker, you don't want it to do this.
           *
           * By setting this value to `true`, Prism will not add its own listeners to the worker.
           *
           * You obviously have to change this value before Prism executes. To do this, you can add an
           * empty Prism object into the global scope before loading the Prism script like this:
           *
           * ```js
           * window.Prism = window.Prism || {};
           * Prism.disableWorkerMessageHandler = true;
           * // Load Prism's script
           * ```
           *
           * @default false
           * @type {boolean}
           * @memberof Prism
           * @public
           */
          disableWorkerMessageHandler: _self2.Prism && _self2.Prism.disableWorkerMessageHandler,
          /**
           * A namespace for utility methods.
           *
           * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
           * change or disappear at any time.
           *
           * @namespace
           * @memberof Prism
           */
          util: {
            encode: function encode(tokens) {
              if (tokens instanceof Token) {
                return new Token(tokens.type, encode(tokens.content), tokens.alias);
              } else if (Array.isArray(tokens)) {
                return tokens.map(encode);
              } else {
                return tokens.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\u00a0/g, " ");
              }
            },
            /**
             * Returns the name of the type of the given value.
             *
             * @param {any} o
             * @returns {string}
             * @example
             * type(null)      === 'Null'
             * type(undefined) === 'Undefined'
             * type(123)       === 'Number'
             * type('foo')     === 'String'
             * type(true)      === 'Boolean'
             * type([1, 2])    === 'Array'
             * type({})        === 'Object'
             * type(String)    === 'Function'
             * type(/abc+/)    === 'RegExp'
             */
            type: function(o2) {
              return Object.prototype.toString.call(o2).slice(8, -1);
            },
            /**
             * Returns a unique number for the given object. Later calls will still return the same number.
             *
             * @param {Object} obj
             * @returns {number}
             */
            objId: function(obj) {
              if (!obj["__id"]) {
                Object.defineProperty(obj, "__id", { value: ++uniqueId });
              }
              return obj["__id"];
            },
            /**
             * Creates a deep clone of the given object.
             *
             * The main intended use of this function is to clone language definitions.
             *
             * @param {T} o
             * @param {Record<number, any>} [visited]
             * @returns {T}
             * @template T
             */
            clone: function deepClone(o2, visited) {
              visited = visited || {};
              var clone;
              var id;
              switch (_2.util.type(o2)) {
                case "Object":
                  id = _2.util.objId(o2);
                  if (visited[id]) {
                    return visited[id];
                  }
                  clone = /** @type {Record<string, any>} */
                  {};
                  visited[id] = clone;
                  for (var key in o2) {
                    if (o2.hasOwnProperty(key)) {
                      clone[key] = deepClone(o2[key], visited);
                    }
                  }
                  return (
                    /** @type {any} */
                    clone
                  );
                case "Array":
                  id = _2.util.objId(o2);
                  if (visited[id]) {
                    return visited[id];
                  }
                  clone = [];
                  visited[id] = clone;
                  o2.forEach(function(v2, i2) {
                    clone[i2] = deepClone(v2, visited);
                  });
                  return (
                    /** @type {any} */
                    clone
                  );
                default:
                  return o2;
              }
            },
            /**
             * Returns the Prism language of the given element set by a `language-xxxx` or `lang-xxxx` class.
             *
             * If no language is set for the element or the element is `null` or `undefined`, `none` will be returned.
             *
             * @param {Element} element
             * @returns {string}
             */
            getLanguage: function(element) {
              while (element) {
                var m2 = lang.exec(element.className);
                if (m2) {
                  return m2[1].toLowerCase();
                }
                element = element.parentElement;
              }
              return "none";
            },
            /**
             * Sets the Prism `language-xxxx` class of the given element.
             *
             * @param {Element} element
             * @param {string} language
             * @returns {void}
             */
            setLanguage: function(element, language) {
              element.className = element.className.replace(RegExp(lang, "gi"), "");
              element.classList.add("language-" + language);
            },
            /**
             * Returns the script element that is currently executing.
             *
             * This does __not__ work for line script element.
             *
             * @returns {HTMLScriptElement | null}
             */
            currentScript: function() {
              if (typeof document === "undefined") {
                return null;
              }
              if (document.currentScript && document.currentScript.tagName === "SCRIPT" && 1 < 2) {
                return (
                  /** @type {any} */
                  document.currentScript
                );
              }
              try {
                throw new Error();
              } catch (err) {
                var src = (/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(err.stack) || [])[1];
                if (src) {
                  var scripts = document.getElementsByTagName("script");
                  for (var i2 in scripts) {
                    if (scripts[i2].src == src) {
                      return scripts[i2];
                    }
                  }
                }
                return null;
              }
            },
            /**
             * Returns whether a given class is active for `element`.
             *
             * The class can be activated if `element` or one of its ancestors has the given class and it can be deactivated
             * if `element` or one of its ancestors has the negated version of the given class. The _negated version_ of the
             * given class is just the given class with a `no-` prefix.
             *
             * Whether the class is active is determined by the closest ancestor of `element` (where `element` itself is
             * closest ancestor) that has the given class or the negated version of it. If neither `element` nor any of its
             * ancestors have the given class or the negated version of it, then the default activation will be returned.
             *
             * In the paradoxical situation where the closest ancestor contains __both__ the given class and the negated
             * version of it, the class is considered active.
             *
             * @param {Element} element
             * @param {string} className
             * @param {boolean} [defaultActivation=false]
             * @returns {boolean}
             */
            isActive: function(element, className, defaultActivation) {
              var no = "no-" + className;
              while (element) {
                var classList = element.classList;
                if (classList.contains(className)) {
                  return true;
                }
                if (classList.contains(no)) {
                  return false;
                }
                element = element.parentElement;
              }
              return !!defaultActivation;
            }
          },
          /**
           * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
           *
           * @namespace
           * @memberof Prism
           * @public
           */
          languages: {
            /**
             * The grammar for plain, unformatted text.
             */
            plain: plainTextGrammar,
            plaintext: plainTextGrammar,
            text: plainTextGrammar,
            txt: plainTextGrammar,
            /**
             * Creates a deep copy of the language with the given id and appends the given tokens.
             *
             * If a token in `redef` also appears in the copied language, then the existing token in the copied language
             * will be overwritten at its original position.
             *
             * ## Best practices
             *
             * Since the position of overwriting tokens (token in `redef` that overwrite tokens in the copied language)
             * doesn't matter, they can technically be in any order. However, this can be confusing to others that trying to
             * understand the language definition because, normally, the order of tokens matters in Prism grammars.
             *
             * Therefore, it is encouraged to order overwriting tokens according to the positions of the overwritten tokens.
             * Furthermore, all non-overwriting tokens should be placed after the overwriting ones.
             *
             * @param {string} id The id of the language to extend. This has to be a key in `Prism.languages`.
             * @param {Grammar} redef The new tokens to append.
             * @returns {Grammar} The new language created.
             * @public
             * @example
             * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
             *     // Prism.languages.css already has a 'comment' token, so this token will overwrite CSS' 'comment' token
             *     // at its original position
             *     'comment': { ... },
             *     // CSS doesn't have a 'color' token, so this token will be appended
             *     'color': /\b(?:red|green|blue)\b/
             * });
             */
            extend: function(id, redef) {
              var lang2 = _2.util.clone(_2.languages[id]);
              for (var key in redef) {
                lang2[key] = redef[key];
              }
              return lang2;
            },
            /**
             * Inserts tokens _before_ another token in a language definition or any other grammar.
             *
             * ## Usage
             *
             * This helper method makes it easy to modify existing languages. For example, the CSS language definition
             * not only defines CSS highlighting for CSS documents, but also needs to define highlighting for CSS embedded
             * in HTML through `<style>` elements. To do this, it needs to modify `Prism.languages.markup` and add the
             * appropriate tokens. However, `Prism.languages.markup` is a regular JavaScript object literal, so if you do
             * this:
             *
             * ```js
             * Prism.languages.markup.style = {
             *     // token
             * };
             * ```
             *
             * then the `style` token will be added (and processed) at the end. `insertBefore` allows you to insert tokens
             * before existing tokens. For the CSS example above, you would use it like this:
             *
             * ```js
             * Prism.languages.insertBefore('markup', 'cdata', {
             *     'style': {
             *         // token
             *     }
             * });
             * ```
             *
             * ## Special cases
             *
             * If the grammars of `inside` and `insert` have tokens with the same name, the tokens in `inside`'s grammar
             * will be ignored.
             *
             * This behavior can be used to insert tokens after `before`:
             *
             * ```js
             * Prism.languages.insertBefore('markup', 'comment', {
             *     'comment': Prism.languages.markup.comment,
             *     // tokens after 'comment'
             * });
             * ```
             *
             * ## Limitations
             *
             * The main problem `insertBefore` has to solve is iteration order. Since ES2015, the iteration order for object
             * properties is guaranteed to be the insertion order (except for integer keys) but some browsers behave
             * differently when keys are deleted and re-inserted. So `insertBefore` can't be implemented by temporarily
             * deleting properties which is necessary to insert at arbitrary positions.
             *
             * To solve this problem, `insertBefore` doesn't actually insert the given tokens into the target object.
             * Instead, it will create a new object and replace all references to the target object with the new one. This
             * can be done without temporarily deleting properties, so the iteration order is well-defined.
             *
             * However, only references that can be reached from `Prism.languages` or `insert` will be replaced. I.e. if
             * you hold the target object in a variable, then the value of the variable will not change.
             *
             * ```js
             * var oldMarkup = Prism.languages.markup;
             * var newMarkup = Prism.languages.insertBefore('markup', 'comment', { ... });
             *
             * assert(oldMarkup !== Prism.languages.markup);
             * assert(newMarkup === Prism.languages.markup);
             * ```
             *
             * @param {string} inside The property of `root` (e.g. a language id in `Prism.languages`) that contains the
             * object to be modified.
             * @param {string} before The key to insert before.
             * @param {Grammar} insert An object containing the key-value pairs to be inserted.
             * @param {Object<string, any>} [root] The object containing `inside`, i.e. the object that contains the
             * object to be modified.
             *
             * Defaults to `Prism.languages`.
             * @returns {Grammar} The new grammar object.
             * @public
             */
            insertBefore: function(inside, before, insert, root) {
              root = root || /** @type {any} */
              _2.languages;
              var grammar = root[inside];
              var ret = {};
              for (var token in grammar) {
                if (grammar.hasOwnProperty(token)) {
                  if (token == before) {
                    for (var newToken in insert) {
                      if (insert.hasOwnProperty(newToken)) {
                        ret[newToken] = insert[newToken];
                      }
                    }
                  }
                  if (!insert.hasOwnProperty(token)) {
                    ret[token] = grammar[token];
                  }
                }
              }
              var old = root[inside];
              root[inside] = ret;
              _2.languages.DFS(_2.languages, function(key, value) {
                if (value === old && key != inside) {
                  this[key] = ret;
                }
              });
              return ret;
            },
            // Traverse a language definition with Depth First Search
            DFS: function DFS(o2, callback, type, visited) {
              visited = visited || {};
              var objId = _2.util.objId;
              for (var i2 in o2) {
                if (o2.hasOwnProperty(i2)) {
                  callback.call(o2, i2, o2[i2], type || i2);
                  var property = o2[i2];
                  var propertyType = _2.util.type(property);
                  if (propertyType === "Object" && !visited[objId(property)]) {
                    visited[objId(property)] = true;
                    DFS(property, callback, null, visited);
                  } else if (propertyType === "Array" && !visited[objId(property)]) {
                    visited[objId(property)] = true;
                    DFS(property, callback, i2, visited);
                  }
                }
              }
            }
          },
          plugins: {},
          /**
           * This is the most high-level function in Prism\u2019s API.
           * It fetches all the elements that have a `.language-xxxx` class and then calls {@link Prism.highlightElement} on
           * each one of them.
           *
           * This is equivalent to `Prism.highlightAllUnder(document, async, callback)`.
           *
           * @param {boolean} [async=false] Same as in {@link Prism.highlightAllUnder}.
           * @param {HighlightCallback} [callback] Same as in {@link Prism.highlightAllUnder}.
           * @memberof Prism
           * @public
           */
          highlightAll: function(async, callback) {
            _2.highlightAllUnder(document, async, callback);
          },
          /**
           * Fetches all the descendants of `container` that have a `.language-xxxx` class and then calls
           * {@link Prism.highlightElement} on each one of them.
           *
           * The following hooks will be run:
           * 1. `before-highlightall`
           * 2. `before-all-elements-highlight`
           * 3. All hooks of {@link Prism.highlightElement} for each element.
           *
           * @param {ParentNode} container The root element, whose descendants that have a `.language-xxxx` class will be highlighted.
           * @param {boolean} [async=false] Whether each element is to be highlighted asynchronously using Web Workers.
           * @param {HighlightCallback} [callback] An optional callback to be invoked on each element after its highlighting is done.
           * @memberof Prism
           * @public
           */
          highlightAllUnder: function(container, async, callback) {
            var env = {
              callback,
              container,
              selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
            };
            _2.hooks.run("before-highlightall", env);
            env.elements = Array.prototype.slice.apply(env.container.querySelectorAll(env.selector));
            _2.hooks.run("before-all-elements-highlight", env);
            for (var i2 = 0, element; element = env.elements[i2++]; ) {
              _2.highlightElement(element, async === true, env.callback);
            }
          },
          /**
           * Highlights the code inside a single element.
           *
           * The following hooks will be run:
           * 1. `before-sanity-check`
           * 2. `before-highlight`
           * 3. All hooks of {@link Prism.highlight}. These hooks will be run by an asynchronous worker if `async` is `true`.
           * 4. `before-insert`
           * 5. `after-highlight`
           * 6. `complete`
           *
           * Some the above hooks will be skipped if the element doesn't contain any text or there is no grammar loaded for
           * the element's language.
           *
           * @param {Element} element The element containing the code.
           * It must have a class of `language-xxxx` to be processed, where `xxxx` is a valid language identifier.
           * @param {boolean} [async=false] Whether the element is to be highlighted asynchronously using Web Workers
           * to improve performance and avoid blocking the UI when highlighting very large chunks of code. This option is
           * [disabled by default](https://prismjs.com/faq.html#why-is-asynchronous-highlighting-disabled-by-default).
           *
           * Note: All language definitions required to highlight the code must be included in the main `prism.js` file for
           * asynchronous highlighting to work. You can build your own bundle on the
           * [Download page](https://prismjs.com/download.html).
           * @param {HighlightCallback} [callback] An optional callback to be invoked after the highlighting is done.
           * Mostly useful when `async` is `true`, since in that case, the highlighting is done asynchronously.
           * @memberof Prism
           * @public
           */
          highlightElement: function(element, async, callback) {
            var language = _2.util.getLanguage(element);
            var grammar = _2.languages[language];
            _2.util.setLanguage(element, language);
            var parent = element.parentElement;
            if (parent && parent.nodeName.toLowerCase() === "pre") {
              _2.util.setLanguage(parent, language);
            }
            var code = element.textContent;
            var env = {
              element,
              language,
              grammar,
              code
            };
            function insertHighlightedCode(highlightedCode) {
              env.highlightedCode = highlightedCode;
              _2.hooks.run("before-insert", env);
              env.element.innerHTML = env.highlightedCode;
              _2.hooks.run("after-highlight", env);
              _2.hooks.run("complete", env);
              callback && callback.call(env.element);
            }
            _2.hooks.run("before-sanity-check", env);
            parent = env.element.parentElement;
            if (parent && parent.nodeName.toLowerCase() === "pre" && !parent.hasAttribute("tabindex")) {
              parent.setAttribute("tabindex", "0");
            }
            if (!env.code) {
              _2.hooks.run("complete", env);
              callback && callback.call(env.element);
              return;
            }
            _2.hooks.run("before-highlight", env);
            if (!env.grammar) {
              insertHighlightedCode(_2.util.encode(env.code));
              return;
            }
            if (async && _self2.Worker) {
              var worker = new Worker(_2.filename);
              worker.onmessage = function(evt) {
                insertHighlightedCode(evt.data);
              };
              worker.postMessage(JSON.stringify({
                language: env.language,
                code: env.code,
                immediateClose: true
              }));
            } else {
              insertHighlightedCode(_2.highlight(env.code, env.grammar, env.language));
            }
          },
          /**
           * Low-level function, only use if you know what you\u2019re doing. It accepts a string of text as input
           * and the language definitions to use, and returns a string with the HTML produced.
           *
           * The following hooks will be run:
           * 1. `before-tokenize`
           * 2. `after-tokenize`
           * 3. `wrap`: On each {@link Token}.
           *
           * @param {string} text A string with the code to be highlighted.
           * @param {Grammar} grammar An object containing the tokens to use.
           *
           * Usually a language definition like `Prism.languages.markup`.
           * @param {string} language The name of the language definition passed to `grammar`.
           * @returns {string} The highlighted HTML.
           * @memberof Prism
           * @public
           * @example
           * Prism.highlight('var foo = true;', Prism.languages.javascript, 'javascript');
           */
          highlight: function(text, grammar, language) {
            var env = {
              code: text,
              grammar,
              language
            };
            _2.hooks.run("before-tokenize", env);
            if (!env.grammar) {
              throw new Error('The language "' + env.language + '" has no grammar.');
            }
            env.tokens = _2.tokenize(env.code, env.grammar);
            _2.hooks.run("after-tokenize", env);
            return Token.stringify(_2.util.encode(env.tokens), env.language);
          },
          /**
           * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
           * and the language definitions to use, and returns an array with the tokenized code.
           *
           * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
           *
           * This method could be useful in other contexts as well, as a very crude parser.
           *
           * @param {string} text A string with the code to be highlighted.
           * @param {Grammar} grammar An object containing the tokens to use.
           *
           * Usually a language definition like `Prism.languages.markup`.
           * @returns {TokenStream} An array of strings and tokens, a token stream.
           * @memberof Prism
           * @public
           * @example
           * let code = `var foo = 0;`;
           * let tokens = Prism.tokenize(code, Prism.languages.javascript);
           * tokens.forEach(token => {
           *     if (token instanceof Prism.Token && token.type === 'number') {
           *         console.log(`Found numeric literal: ${token.content}`);
           *     }
           * });
           */
          tokenize: function(text, grammar) {
            var rest = grammar.rest;
            if (rest) {
              for (var token in rest) {
                grammar[token] = rest[token];
              }
              delete grammar.rest;
            }
            var tokenList = new LinkedList();
            addAfter(tokenList, tokenList.head, text);
            matchGrammar(text, tokenList, grammar, tokenList.head, 0);
            return toArray(tokenList);
          },
          /**
           * @namespace
           * @memberof Prism
           * @public
           */
          hooks: {
            all: {},
            /**
             * Adds the given callback to the list of callbacks for the given hook.
             *
             * The callback will be invoked when the hook it is registered for is run.
             * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
             *
             * One callback function can be registered to multiple hooks and the same hook multiple times.
             *
             * @param {string} name The name of the hook.
             * @param {HookCallback} callback The callback function which is given environment variables.
             * @public
             */
            add: function(name, callback) {
              var hooks = _2.hooks.all;
              hooks[name] = hooks[name] || [];
              hooks[name].push(callback);
            },
            /**
             * Runs a hook invoking all registered callbacks with the given environment variables.
             *
             * Callbacks will be invoked synchronously and in the order in which they were registered.
             *
             * @param {string} name The name of the hook.
             * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
             * @public
             */
            run: function(name, env) {
              var callbacks = _2.hooks.all[name];
              if (!callbacks || !callbacks.length) {
                return;
              }
              for (var i2 = 0, callback; callback = callbacks[i2++]; ) {
                callback(env);
              }
            }
          },
          Token
        };
        _self2.Prism = _2;
        function Token(type, content, alias, matchedStr) {
          this.type = type;
          this.content = content;
          this.alias = alias;
          this.length = (matchedStr || "").length | 0;
        }
        Token.stringify = function stringify(o2, language) {
          if (typeof o2 == "string") {
            return o2;
          }
          if (Array.isArray(o2)) {
            var s2 = "";
            o2.forEach(function(e2) {
              s2 += stringify(e2, language);
            });
            return s2;
          }
          var env = {
            type: o2.type,
            content: stringify(o2.content, language),
            tag: "span",
            classes: ["token", o2.type],
            attributes: {},
            language
          };
          var aliases = o2.alias;
          if (aliases) {
            if (Array.isArray(aliases)) {
              Array.prototype.push.apply(env.classes, aliases);
            } else {
              env.classes.push(aliases);
            }
          }
          _2.hooks.run("wrap", env);
          var attributes = "";
          for (var name in env.attributes) {
            attributes += " " + name + '="' + (env.attributes[name] || "").replace(/"/g, "&quot;") + '"';
          }
          return "<" + env.tag + ' class="' + env.classes.join(" ") + '"' + attributes + ">" + env.content + "</" + env.tag + ">";
        };
        function matchPattern(pattern, pos, text, lookbehind) {
          pattern.lastIndex = pos;
          var match = pattern.exec(text);
          if (match && lookbehind && match[1]) {
            var lookbehindLength = match[1].length;
            match.index += lookbehindLength;
            match[0] = match[0].slice(lookbehindLength);
          }
          return match;
        }
        function matchGrammar(text, tokenList, grammar, startNode, startPos, rematch) {
          for (var token in grammar) {
            if (!grammar.hasOwnProperty(token) || !grammar[token]) {
              continue;
            }
            var patterns = grammar[token];
            patterns = Array.isArray(patterns) ? patterns : [patterns];
            for (var j2 = 0; j2 < patterns.length; ++j2) {
              if (rematch && rematch.cause == token + "," + j2) {
                return;
              }
              var patternObj = patterns[j2];
              var inside = patternObj.inside;
              var lookbehind = !!patternObj.lookbehind;
              var greedy = !!patternObj.greedy;
              var alias = patternObj.alias;
              if (greedy && !patternObj.pattern.global) {
                var flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
                patternObj.pattern = RegExp(patternObj.pattern.source, flags + "g");
              }
              var pattern = patternObj.pattern || patternObj;
              for (var currentNode = startNode.next, pos = startPos; currentNode !== tokenList.tail; pos += currentNode.value.length, currentNode = currentNode.next) {
                if (rematch && pos >= rematch.reach) {
                  break;
                }
                var str = currentNode.value;
                if (tokenList.length > text.length) {
                  return;
                }
                if (str instanceof Token) {
                  continue;
                }
                var removeCount = 1;
                var match;
                if (greedy) {
                  match = matchPattern(pattern, pos, text, lookbehind);
                  if (!match || match.index >= text.length) {
                    break;
                  }
                  var from = match.index;
                  var to = match.index + match[0].length;
                  var p2 = pos;
                  p2 += currentNode.value.length;
                  while (from >= p2) {
                    currentNode = currentNode.next;
                    p2 += currentNode.value.length;
                  }
                  p2 -= currentNode.value.length;
                  pos = p2;
                  if (currentNode.value instanceof Token) {
                    continue;
                  }
                  for (var k2 = currentNode; k2 !== tokenList.tail && (p2 < to || typeof k2.value === "string"); k2 = k2.next) {
                    removeCount++;
                    p2 += k2.value.length;
                  }
                  removeCount--;
                  str = text.slice(pos, p2);
                  match.index -= pos;
                } else {
                  match = matchPattern(pattern, 0, str, lookbehind);
                  if (!match) {
                    continue;
                  }
                }
                var from = match.index;
                var matchStr = match[0];
                var before = str.slice(0, from);
                var after = str.slice(from + matchStr.length);
                var reach = pos + str.length;
                if (rematch && reach > rematch.reach) {
                  rematch.reach = reach;
                }
                var removeFrom = currentNode.prev;
                if (before) {
                  removeFrom = addAfter(tokenList, removeFrom, before);
                  pos += before.length;
                }
                removeRange(tokenList, removeFrom, removeCount);
                var wrapped = new Token(token, inside ? _2.tokenize(matchStr, inside) : matchStr, alias, matchStr);
                currentNode = addAfter(tokenList, removeFrom, wrapped);
                if (after) {
                  addAfter(tokenList, currentNode, after);
                }
                if (removeCount > 1) {
                  var nestedRematch = {
                    cause: token + "," + j2,
                    reach
                  };
                  matchGrammar(text, tokenList, grammar, currentNode.prev, pos, nestedRematch);
                  if (rematch && nestedRematch.reach > rematch.reach) {
                    rematch.reach = nestedRematch.reach;
                  }
                }
              }
            }
          }
        }
        function LinkedList() {
          var head = { value: null, prev: null, next: null };
          var tail = { value: null, prev: head, next: null };
          head.next = tail;
          this.head = head;
          this.tail = tail;
          this.length = 0;
        }
        function addAfter(list, node, value) {
          var next = node.next;
          var newNode = { value, prev: node, next };
          node.next = newNode;
          next.prev = newNode;
          list.length++;
          return newNode;
        }
        function removeRange(list, node, count) {
          var next = node.next;
          for (var i2 = 0; i2 < count && next !== list.tail; i2++) {
            next = next.next;
          }
          node.next = next;
          next.prev = node;
          list.length -= i2;
        }
        function toArray(list) {
          var array = [];
          var node = list.head.next;
          while (node !== list.tail) {
            array.push(node.value);
            node = node.next;
          }
          return array;
        }
        if (!_self2.document) {
          if (!_self2.addEventListener) {
            return _2;
          }
          if (!_2.disableWorkerMessageHandler) {
            _self2.addEventListener("message", function(evt) {
              var message = JSON.parse(evt.data);
              var lang2 = message.language;
              var code = message.code;
              var immediateClose = message.immediateClose;
              _self2.postMessage(_2.highlight(code, _2.languages[lang2], lang2));
              if (immediateClose) {
                _self2.close();
              }
            }, false);
          }
          return _2;
        }
        var script = _2.util.currentScript();
        if (script) {
          _2.filename = script.src;
          if (script.hasAttribute("data-manual")) {
            _2.manual = true;
          }
        }
        function highlightAutomaticallyCallback() {
          if (!_2.manual) {
            _2.highlightAll();
          }
        }
        if (!_2.manual) {
          var readyState = document.readyState;
          if (readyState === "loading" || readyState === "interactive" && script && script.defer) {
            document.addEventListener("DOMContentLoaded", highlightAutomaticallyCallback);
          } else {
            if (window.requestAnimationFrame) {
              window.requestAnimationFrame(highlightAutomaticallyCallback);
            } else {
              window.setTimeout(highlightAutomaticallyCallback, 16);
            }
          }
        }
        return _2;
      })(_self);
      if (module.exports) {
        module.exports = Prism2;
      }
      if (typeof commonjsGlobal !== "undefined") {
        commonjsGlobal.Prism = Prism2;
      }
      Prism2.languages.markup = {
        "comment": {
          pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
          greedy: true
        },
        "prolog": {
          pattern: /<\?[\s\S]+?\?>/,
          greedy: true
        },
        "doctype": {
          // https://www.w3.org/TR/xml/#NT-doctypedecl
          pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
          greedy: true,
          inside: {
            "internal-subset": {
              pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
              lookbehind: true,
              greedy: true,
              inside: null
              // see below
            },
            "string": {
              pattern: /"[^"]*"|'[^']*'/,
              greedy: true
            },
            "punctuation": /^<!|>$|[[\]]/,
            "doctype-tag": /^DOCTYPE/i,
            "name": /[^\s<>'"]+/
          }
        },
        "cdata": {
          pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
          greedy: true
        },
        "tag": {
          pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
          greedy: true,
          inside: {
            "tag": {
              pattern: /^<\/?[^\s>\/]+/,
              inside: {
                "punctuation": /^<\/?/,
                "namespace": /^[^\s>\/:]+:/
              }
            },
            "special-attr": [],
            "attr-value": {
              pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
              inside: {
                "punctuation": [
                  {
                    pattern: /^=/,
                    alias: "attr-equals"
                  },
                  {
                    pattern: /^(\s*)["']|["']$/,
                    lookbehind: true
                  }
                ]
              }
            },
            "punctuation": /\/?>/,
            "attr-name": {
              pattern: /[^\s>\/]+/,
              inside: {
                "namespace": /^[^\s>\/:]+:/
              }
            }
          }
        },
        "entity": [
          {
            pattern: /&[\da-z]{1,8};/i,
            alias: "named-entity"
          },
          /&#x?[\da-f]{1,8};/i
        ]
      };
      Prism2.languages.markup["tag"].inside["attr-value"].inside["entity"] = Prism2.languages.markup["entity"];
      Prism2.languages.markup["doctype"].inside["internal-subset"].inside = Prism2.languages.markup;
      Prism2.hooks.add("wrap", function(env) {
        if (env.type === "entity") {
          env.attributes["title"] = env.content.replace(/&amp;/, "&");
        }
      });
      Object.defineProperty(Prism2.languages.markup.tag, "addInlined", {
        /**
         * Adds an inlined language to markup.
         *
         * An example of an inlined language is CSS with `<style>` tags.
         *
         * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
         * case insensitive.
         * @param {string} lang The language key.
         * @example
         * addInlined('style', 'css');
         */
        value: function addInlined(tagName, lang) {
          var includedCdataInside = {};
          includedCdataInside["language-" + lang] = {
            pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
            lookbehind: true,
            inside: Prism2.languages[lang]
          };
          includedCdataInside["cdata"] = /^<!\[CDATA\[|\]\]>$/i;
          var inside = {
            "included-cdata": {
              pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
              inside: includedCdataInside
            }
          };
          inside["language-" + lang] = {
            pattern: /[\s\S]+/,
            inside: Prism2.languages[lang]
          };
          var def = {};
          def[tagName] = {
            pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function() {
              return tagName;
            }), "i"),
            lookbehind: true,
            greedy: true,
            inside
          };
          Prism2.languages.insertBefore("markup", "cdata", def);
        }
      });
      Object.defineProperty(Prism2.languages.markup.tag, "addAttribute", {
        /**
         * Adds an pattern to highlight languages embedded in HTML attributes.
         *
         * An example of an inlined language is CSS with `style` attributes.
         *
         * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
         * case insensitive.
         * @param {string} lang The language key.
         * @example
         * addAttribute('style', 'css');
         */
        value: function(attrName, lang) {
          Prism2.languages.markup.tag.inside["special-attr"].push({
            pattern: RegExp(
              /(^|["'\s])/.source + "(?:" + attrName + ")" + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
              "i"
            ),
            lookbehind: true,
            inside: {
              "attr-name": /^[^\s=]+/,
              "attr-value": {
                pattern: /=[\s\S]+/,
                inside: {
                  "value": {
                    pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
                    lookbehind: true,
                    alias: [lang, "language-" + lang],
                    inside: Prism2.languages[lang]
                  },
                  "punctuation": [
                    {
                      pattern: /^=/,
                      alias: "attr-equals"
                    },
                    /"|'/
                  ]
                }
              }
            }
          });
        }
      });
      Prism2.languages.html = Prism2.languages.markup;
      Prism2.languages.mathml = Prism2.languages.markup;
      Prism2.languages.svg = Prism2.languages.markup;
      Prism2.languages.xml = Prism2.languages.extend("markup", {});
      Prism2.languages.ssml = Prism2.languages.xml;
      Prism2.languages.atom = Prism2.languages.xml;
      Prism2.languages.rss = Prism2.languages.xml;
      (function(Prism22) {
        var string = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;
        Prism22.languages.css = {
          "comment": /\/\*[\s\S]*?\*\//,
          "atrule": {
            pattern: RegExp("@[\\w-](?:" + /[^;{\s"']|\s+(?!\s)/.source + "|" + string.source + ")*?" + /(?:;|(?=\s*\{))/.source),
            inside: {
              "rule": /^@[\w-]+/,
              "selector-function-argument": {
                pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
                lookbehind: true,
                alias: "selector"
              },
              "keyword": {
                pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
                lookbehind: true
              }
              // See rest below
            }
          },
          "url": {
            // https://drafts.csswg.org/css-values-3/#urls
            pattern: RegExp("\\burl\\((?:" + string.source + "|" + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ")\\)", "i"),
            greedy: true,
            inside: {
              "function": /^url/i,
              "punctuation": /^\(|\)$/,
              "string": {
                pattern: RegExp("^" + string.source + "$"),
                alias: "url"
              }
            }
          },
          "selector": {
            pattern: RegExp(`(^|[{}\\s])[^{}\\s](?:[^{};"'\\s]|\\s+(?![\\s{])|` + string.source + ")*(?=\\s*\\{)"),
            lookbehind: true
          },
          "string": {
            pattern: string,
            greedy: true
          },
          "property": {
            pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
            lookbehind: true
          },
          "important": /!important\b/i,
          "function": {
            pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
            lookbehind: true
          },
          "punctuation": /[(){};:,]/
        };
        Prism22.languages.css["atrule"].inside.rest = Prism22.languages.css;
        var markup = Prism22.languages.markup;
        if (markup) {
          markup.tag.addInlined("style", "css");
          markup.tag.addAttribute("style", "css");
        }
      })(Prism2);
      Prism2.languages.clike = {
        "comment": [
          {
            pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
            lookbehind: true,
            greedy: true
          },
          {
            pattern: /(^|[^\\:])\/\/.*/,
            lookbehind: true,
            greedy: true
          }
        ],
        "string": {
          pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
          greedy: true
        },
        "class-name": {
          pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
          lookbehind: true,
          inside: {
            "punctuation": /[.\\]/
          }
        },
        "keyword": /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
        "boolean": /\b(?:false|true)\b/,
        "function": /\b\w+(?=\()/,
        "number": /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
        "operator": /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
        "punctuation": /[{}[\];(),.:]/
      };
      Prism2.languages.javascript = Prism2.languages.extend("clike", {
        "class-name": [
          Prism2.languages.clike["class-name"],
          {
            pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
            lookbehind: true
          }
        ],
        "keyword": [
          {
            pattern: /((?:^|\})\s*)catch\b/,
            lookbehind: true
          },
          {
            pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
            lookbehind: true
          }
        ],
        // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
        "function": /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
        "number": {
          pattern: RegExp(
            /(^|[^\w$])/.source + "(?:" + // constant
            (/NaN|Infinity/.source + "|" + // binary integer
            /0[bB][01]+(?:_[01]+)*n?/.source + "|" + // octal integer
            /0[oO][0-7]+(?:_[0-7]+)*n?/.source + "|" + // hexadecimal integer
            /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + "|" + // decimal bigint
            /\d+(?:_\d+)*n/.source + "|" + // decimal number (integer or float) but no bigint
            /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ")" + /(?![\w$])/.source
          ),
          lookbehind: true
        },
        "operator": /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
      });
      Prism2.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;
      Prism2.languages.insertBefore("javascript", "keyword", {
        "regex": {
          pattern: RegExp(
            // lookbehind
            // eslint-disable-next-line regexp/no-dupe-characters-character-class
            /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source + // Regex pattern:
            // There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
            // classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
            // with the only syntax, so we have to define 2 different regex patterns.
            /\//.source + "(?:" + /(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source + "|" + // `v` flag syntax. This supports 3 levels of nested character classes.
            /(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source + ")" + // lookahead
            /(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
          ),
          lookbehind: true,
          greedy: true,
          inside: {
            "regex-source": {
              pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
              lookbehind: true,
              alias: "language-regex",
              inside: Prism2.languages.regex
            },
            "regex-delimiter": /^\/|\/$/,
            "regex-flags": /^[a-z]+$/
          }
        },
        // This must be declared before keyword because we use "function" inside the look-forward
        "function-variable": {
          pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
          alias: "function"
        },
        "parameter": [
          {
            pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
            lookbehind: true,
            inside: Prism2.languages.javascript
          },
          {
            pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
            lookbehind: true,
            inside: Prism2.languages.javascript
          },
          {
            pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
            lookbehind: true,
            inside: Prism2.languages.javascript
          },
          {
            pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
            lookbehind: true,
            inside: Prism2.languages.javascript
          }
        ],
        "constant": /\b[A-Z](?:[A-Z_]|\dx?)*\b/
      });
      Prism2.languages.insertBefore("javascript", "string", {
        "hashbang": {
          pattern: /^#!.*/,
          greedy: true,
          alias: "comment"
        },
        "template-string": {
          pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
          greedy: true,
          inside: {
            "template-punctuation": {
              pattern: /^`|`$/,
              alias: "string"
            },
            "interpolation": {
              pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
              lookbehind: true,
              inside: {
                "interpolation-punctuation": {
                  pattern: /^\$\{|\}$/,
                  alias: "punctuation"
                },
                rest: Prism2.languages.javascript
              }
            },
            "string": /[\s\S]+/
          }
        },
        "string-property": {
          pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
          lookbehind: true,
          greedy: true,
          alias: "property"
        }
      });
      Prism2.languages.insertBefore("javascript", "operator", {
        "literal-property": {
          pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
          lookbehind: true,
          alias: "property"
        }
      });
      if (Prism2.languages.markup) {
        Prism2.languages.markup.tag.addInlined("script", "javascript");
        Prism2.languages.markup.tag.addAttribute(
          /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
          "javascript"
        );
      }
      Prism2.languages.js = Prism2.languages.javascript;
      (function() {
        if (typeof Prism2 === "undefined" || typeof document === "undefined") {
          return;
        }
        if (!Element.prototype.matches) {
          Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
        }
        var LOADING_MESSAGE = "Loading\u2026";
        var FAILURE_MESSAGE = function(status, message) {
          return "\u2716 Error " + status + " while fetching file: " + message;
        };
        var FAILURE_EMPTY_MESSAGE = "\u2716 Error: File does not exist or is empty";
        var EXTENSIONS = {
          "js": "javascript",
          "py": "python",
          "rb": "ruby",
          "ps1": "powershell",
          "psm1": "powershell",
          "sh": "bash",
          "bat": "batch",
          "h": "c",
          "tex": "latex"
        };
        var STATUS_ATTR = "data-src-status";
        var STATUS_LOADING = "loading";
        var STATUS_LOADED = "loaded";
        var STATUS_FAILED = "failed";
        var SELECTOR = "pre[data-src]:not([" + STATUS_ATTR + '="' + STATUS_LOADED + '"]):not([' + STATUS_ATTR + '="' + STATUS_LOADING + '"])';
        function loadFile(src, success, error) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", src, true);
          xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
              if (xhr.status < 400 && xhr.responseText) {
                success(xhr.responseText);
              } else {
                if (xhr.status >= 400) {
                  error(FAILURE_MESSAGE(xhr.status, xhr.statusText));
                } else {
                  error(FAILURE_EMPTY_MESSAGE);
                }
              }
            }
          };
          xhr.send(null);
        }
        function parseRange(range) {
          var m2 = /^\s*(\d+)\s*(?:(,)\s*(?:(\d+)\s*)?)?$/.exec(range || "");
          if (m2) {
            var start = Number(m2[1]);
            var comma = m2[2];
            var end = m2[3];
            if (!comma) {
              return [start, start];
            }
            if (!end) {
              return [start, void 0];
            }
            return [start, Number(end)];
          }
          return void 0;
        }
        Prism2.hooks.add("before-highlightall", function(env) {
          env.selector += ", " + SELECTOR;
        });
        Prism2.hooks.add("before-sanity-check", function(env) {
          var pre = (
            /** @type {HTMLPreElement} */
            env.element
          );
          if (pre.matches(SELECTOR)) {
            env.code = "";
            pre.setAttribute(STATUS_ATTR, STATUS_LOADING);
            var code = pre.appendChild(document.createElement("CODE"));
            code.textContent = LOADING_MESSAGE;
            var src = pre.getAttribute("data-src");
            var language = env.language;
            if (language === "none") {
              var extension = (/\.(\w+)$/.exec(src) || [, "none"])[1];
              language = EXTENSIONS[extension] || extension;
            }
            Prism2.util.setLanguage(code, language);
            Prism2.util.setLanguage(pre, language);
            var autoloader = Prism2.plugins.autoloader;
            if (autoloader) {
              autoloader.loadLanguages(language);
            }
            loadFile(
              src,
              function(text) {
                pre.setAttribute(STATUS_ATTR, STATUS_LOADED);
                var range = parseRange(pre.getAttribute("data-range"));
                if (range) {
                  var lines = text.split(/\r\n?|\n/g);
                  var start = range[0];
                  var end = range[1] == null ? lines.length : range[1];
                  if (start < 0) {
                    start += lines.length;
                  }
                  start = Math.max(0, Math.min(start - 1, lines.length));
                  if (end < 0) {
                    end += lines.length;
                  }
                  end = Math.max(0, Math.min(end, lines.length));
                  text = lines.slice(start, end).join("\n");
                  if (!pre.hasAttribute("data-start")) {
                    pre.setAttribute("data-start", String(start + 1));
                  }
                }
                code.textContent = text;
                Prism2.highlightElement(code);
              },
              function(error) {
                pre.setAttribute(STATUS_ATTR, STATUS_FAILED);
                code.textContent = error;
              }
            );
          }
        });
        Prism2.plugins.fileHighlight = {
          /**
           * Executes the File Highlight plugin for all matching `pre` elements under the given container.
           *
           * Note: Elements which are already loaded or currently loading will not be touched by this method.
           *
           * @param {ParentNode} [container=document]
           */
          highlight: function highlight(container) {
            var elements = (container || document).querySelectorAll(SELECTOR);
            for (var i2 = 0, element; element = elements[i2++]; ) {
              Prism2.highlightElement(element);
            }
          }
        };
        var logged = false;
        Prism2.fileHighlight = function() {
          if (!logged) {
            console.warn("Prism.fileHighlight is deprecated. Use `Prism.plugins.fileHighlight.highlight` instead.");
            logged = true;
          }
          Prism2.plugins.fileHighlight.highlight.apply(this, arguments);
        };
      })();
    })(prism);
    return prism.exports;
  }
  requirePrism();
  Prism.languages.clike = {
    "comment": [
      {
        pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
        lookbehind: true,
        greedy: true
      },
      {
        pattern: /(^|[^\\:])\/\/.*/,
        lookbehind: true,
        greedy: true
      }
    ],
    "string": {
      pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
      greedy: true
    },
    "class-name": {
      pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
      lookbehind: true,
      inside: {
        "punctuation": /[.\\]/
      }
    },
    "keyword": /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
    "boolean": /\b(?:false|true)\b/,
    "function": /\b\w+(?=\()/,
    "number": /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
    "operator": /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
    "punctuation": /[{}[\];(),.:]/
  };
  Prism.languages.javascript = Prism.languages.extend("clike", {
    "class-name": [
      Prism.languages.clike["class-name"],
      {
        pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
        lookbehind: true
      }
    ],
    "keyword": [
      {
        pattern: /((?:^|\})\s*)catch\b/,
        lookbehind: true
      },
      {
        pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
        lookbehind: true
      }
    ],
    // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
    "function": /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
    "number": {
      pattern: RegExp(
        /(^|[^\w$])/.source + "(?:" + // constant
        (/NaN|Infinity/.source + "|" + // binary integer
        /0[bB][01]+(?:_[01]+)*n?/.source + "|" + // octal integer
        /0[oO][0-7]+(?:_[0-7]+)*n?/.source + "|" + // hexadecimal integer
        /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + "|" + // decimal bigint
        /\d+(?:_\d+)*n/.source + "|" + // decimal number (integer or float) but no bigint
        /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ")" + /(?![\w$])/.source
      ),
      lookbehind: true
    },
    "operator": /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
  });
  Prism.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;
  Prism.languages.insertBefore("javascript", "keyword", {
    "regex": {
      pattern: RegExp(
        // lookbehind
        // eslint-disable-next-line regexp/no-dupe-characters-character-class
        /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source + // Regex pattern:
        // There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
        // classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
        // with the only syntax, so we have to define 2 different regex patterns.
        /\//.source + "(?:" + /(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source + "|" + // `v` flag syntax. This supports 3 levels of nested character classes.
        /(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source + ")" + // lookahead
        /(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
      ),
      lookbehind: true,
      greedy: true,
      inside: {
        "regex-source": {
          pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
          lookbehind: true,
          alias: "language-regex",
          inside: Prism.languages.regex
        },
        "regex-delimiter": /^\/|\/$/,
        "regex-flags": /^[a-z]+$/
      }
    },
    // This must be declared before keyword because we use "function" inside the look-forward
    "function-variable": {
      pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
      alias: "function"
    },
    "parameter": [
      {
        pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
        lookbehind: true,
        inside: Prism.languages.javascript
      },
      {
        pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
        lookbehind: true,
        inside: Prism.languages.javascript
      },
      {
        pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
        lookbehind: true,
        inside: Prism.languages.javascript
      },
      {
        pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
        lookbehind: true,
        inside: Prism.languages.javascript
      }
    ],
    "constant": /\b[A-Z](?:[A-Z_]|\dx?)*\b/
  });
  Prism.languages.insertBefore("javascript", "string", {
    "hashbang": {
      pattern: /^#!.*/,
      greedy: true,
      alias: "comment"
    },
    "template-string": {
      pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
      greedy: true,
      inside: {
        "template-punctuation": {
          pattern: /^`|`$/,
          alias: "string"
        },
        "interpolation": {
          pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
          lookbehind: true,
          inside: {
            "interpolation-punctuation": {
              pattern: /^\$\{|\}$/,
              alias: "punctuation"
            },
            rest: Prism.languages.javascript
          }
        },
        "string": /[\s\S]+/
      }
    },
    "string-property": {
      pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
      lookbehind: true,
      greedy: true,
      alias: "property"
    }
  });
  Prism.languages.insertBefore("javascript", "operator", {
    "literal-property": {
      pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
      lookbehind: true,
      alias: "property"
    }
  });
  if (Prism.languages.markup) {
    Prism.languages.markup.tag.addInlined("script", "javascript");
    Prism.languages.markup.tag.addAttribute(
      /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
      "javascript"
    );
  }
  Prism.languages.js = Prism.languages.javascript;
  Prism.languages.markup = {
    "comment": {
      pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
      greedy: true
    },
    "prolog": {
      pattern: /<\?[\s\S]+?\?>/,
      greedy: true
    },
    "doctype": {
      // https://www.w3.org/TR/xml/#NT-doctypedecl
      pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
      greedy: true,
      inside: {
        "internal-subset": {
          pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
          lookbehind: true,
          greedy: true,
          inside: null
          // see below
        },
        "string": {
          pattern: /"[^"]*"|'[^']*'/,
          greedy: true
        },
        "punctuation": /^<!|>$|[[\]]/,
        "doctype-tag": /^DOCTYPE/i,
        "name": /[^\s<>'"]+/
      }
    },
    "cdata": {
      pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
      greedy: true
    },
    "tag": {
      pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
      greedy: true,
      inside: {
        "tag": {
          pattern: /^<\/?[^\s>\/]+/,
          inside: {
            "punctuation": /^<\/?/,
            "namespace": /^[^\s>\/:]+:/
          }
        },
        "special-attr": [],
        "attr-value": {
          pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
          inside: {
            "punctuation": [
              {
                pattern: /^=/,
                alias: "attr-equals"
              },
              {
                pattern: /^(\s*)["']|["']$/,
                lookbehind: true
              }
            ]
          }
        },
        "punctuation": /\/?>/,
        "attr-name": {
          pattern: /[^\s>\/]+/,
          inside: {
            "namespace": /^[^\s>\/:]+:/
          }
        }
      }
    },
    "entity": [
      {
        pattern: /&[\da-z]{1,8};/i,
        alias: "named-entity"
      },
      /&#x?[\da-f]{1,8};/i
    ]
  };
  Prism.languages.markup["tag"].inside["attr-value"].inside["entity"] = Prism.languages.markup["entity"];
  Prism.languages.markup["doctype"].inside["internal-subset"].inside = Prism.languages.markup;
  Prism.hooks.add("wrap", function(env) {
    if (env.type === "entity") {
      env.attributes["title"] = env.content.replace(/&amp;/, "&");
    }
  });
  Object.defineProperty(Prism.languages.markup.tag, "addInlined", {
    /**
     * Adds an inlined language to markup.
     *
     * An example of an inlined language is CSS with `<style>` tags.
     *
     * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
     * case insensitive.
     * @param {string} lang The language key.
     * @example
     * addInlined('style', 'css');
     */
    value: function addInlined(tagName, lang) {
      var includedCdataInside = {};
      includedCdataInside["language-" + lang] = {
        pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
        lookbehind: true,
        inside: Prism.languages[lang]
      };
      includedCdataInside["cdata"] = /^<!\[CDATA\[|\]\]>$/i;
      var inside = {
        "included-cdata": {
          pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
          inside: includedCdataInside
        }
      };
      inside["language-" + lang] = {
        pattern: /[\s\S]+/,
        inside: Prism.languages[lang]
      };
      var def = {};
      def[tagName] = {
        pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function() {
          return tagName;
        }), "i"),
        lookbehind: true,
        greedy: true,
        inside
      };
      Prism.languages.insertBefore("markup", "cdata", def);
    }
  });
  Object.defineProperty(Prism.languages.markup.tag, "addAttribute", {
    /**
     * Adds an pattern to highlight languages embedded in HTML attributes.
     *
     * An example of an inlined language is CSS with `style` attributes.
     *
     * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
     * case insensitive.
     * @param {string} lang The language key.
     * @example
     * addAttribute('style', 'css');
     */
    value: function(attrName, lang) {
      Prism.languages.markup.tag.inside["special-attr"].push({
        pattern: RegExp(
          /(^|["'\s])/.source + "(?:" + attrName + ")" + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
          "i"
        ),
        lookbehind: true,
        inside: {
          "attr-name": /^[^\s=]+/,
          "attr-value": {
            pattern: /=[\s\S]+/,
            inside: {
              "value": {
                pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
                lookbehind: true,
                alias: [lang, "language-" + lang],
                inside: Prism.languages[lang]
              },
              "punctuation": [
                {
                  pattern: /^=/,
                  alias: "attr-equals"
                },
                /"|'/
              ]
            }
          }
        }
      });
    }
  });
  Prism.languages.html = Prism.languages.markup;
  Prism.languages.mathml = Prism.languages.markup;
  Prism.languages.svg = Prism.languages.markup;
  Prism.languages.xml = Prism.languages.extend("markup", {});
  Prism.languages.ssml = Prism.languages.xml;
  Prism.languages.atom = Prism.languages.xml;
  Prism.languages.rss = Prism.languages.xml;
  (function(Prism2) {
    var inner = /(?:\\.|[^\\\n\r]|(?:\n|\r\n?)(?![\r\n]))/.source;
    function createInline(pattern) {
      pattern = pattern.replace(/<inner>/g, function() {
        return inner;
      });
      return RegExp(/((?:^|[^\\])(?:\\{2})*)/.source + "(?:" + pattern + ")");
    }
    var tableCell = /(?:\\.|``(?:[^`\r\n]|`(?!`))+``|`[^`\r\n]+`|[^\\|\r\n`])+/.source;
    var tableRow = /\|?__(?:\|__)+\|?(?:(?:\n|\r\n?)|(?![\s\S]))/.source.replace(/__/g, function() {
      return tableCell;
    });
    var tableLine = /\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?(?:\n|\r\n?)/.source;
    Prism2.languages.markdown = Prism2.languages.extend("markup", {});
    Prism2.languages.insertBefore("markdown", "prolog", {
      "front-matter-block": {
        pattern: /(^(?:\s*[\r\n])?)---(?!.)[\s\S]*?[\r\n]---(?!.)/,
        lookbehind: true,
        greedy: true,
        inside: {
          "punctuation": /^---|---$/,
          "front-matter": {
            pattern: /\S+(?:\s+\S+)*/,
            alias: ["yaml", "language-yaml"],
            inside: Prism2.languages.yaml
          }
        }
      },
      "blockquote": {
        // > ...
        pattern: /^>(?:[\t ]*>)*/m,
        alias: "punctuation"
      },
      "table": {
        pattern: RegExp("^" + tableRow + tableLine + "(?:" + tableRow + ")*", "m"),
        inside: {
          "table-data-rows": {
            pattern: RegExp("^(" + tableRow + tableLine + ")(?:" + tableRow + ")*$"),
            lookbehind: true,
            inside: {
              "table-data": {
                pattern: RegExp(tableCell),
                inside: Prism2.languages.markdown
              },
              "punctuation": /\|/
            }
          },
          "table-line": {
            pattern: RegExp("^(" + tableRow + ")" + tableLine + "$"),
            lookbehind: true,
            inside: {
              "punctuation": /\||:?-{3,}:?/
            }
          },
          "table-header-row": {
            pattern: RegExp("^" + tableRow + "$"),
            inside: {
              "table-header": {
                pattern: RegExp(tableCell),
                alias: "important",
                inside: Prism2.languages.markdown
              },
              "punctuation": /\|/
            }
          }
        }
      },
      "code": [
        {
          // Prefixed by 4 spaces or 1 tab and preceded by an empty line
          pattern: /((?:^|\n)[ \t]*\n|(?:^|\r\n?)[ \t]*\r\n?)(?: {4}|\t).+(?:(?:\n|\r\n?)(?: {4}|\t).+)*/,
          lookbehind: true,
          alias: "keyword"
        },
        {
          // ```optional language
          // code block
          // ```
          pattern: /^```[\s\S]*?^```$/m,
          greedy: true,
          inside: {
            "code-block": {
              pattern: /^(```.*(?:\n|\r\n?))[\s\S]+?(?=(?:\n|\r\n?)^```$)/m,
              lookbehind: true
            },
            "code-language": {
              pattern: /^(```).+/,
              lookbehind: true
            },
            "punctuation": /```/
          }
        }
      ],
      "title": [
        {
          // title 1
          // =======
          // title 2
          // -------
          pattern: /\S.*(?:\n|\r\n?)(?:==+|--+)(?=[ \t]*$)/m,
          alias: "important",
          inside: {
            punctuation: /==+$|--+$/
          }
        },
        {
          // # title 1
          // ###### title 6
          pattern: /(^\s*)#.+/m,
          lookbehind: true,
          alias: "important",
          inside: {
            punctuation: /^#+|#+$/
          }
        }
      ],
      "hr": {
        // ***
        // ---
        // * * *
        // -----------
        pattern: /(^\s*)([*-])(?:[\t ]*\2){2,}(?=\s*$)/m,
        lookbehind: true,
        alias: "punctuation"
      },
      "list": {
        // * item
        // + item
        // - item
        // 1. item
        pattern: /(^\s*)(?:[*+-]|\d+\.)(?=[\t ].)/m,
        lookbehind: true,
        alias: "punctuation"
      },
      "url-reference": {
        // [id]: http://example.com "Optional title"
        // [id]: http://example.com 'Optional title'
        // [id]: http://example.com (Optional title)
        // [id]: <http://example.com> "Optional title"
        pattern: /!?\[[^\]]+\]:[\t ]+(?:\S+|<(?:\\.|[^>\\])+>)(?:[\t ]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?/,
        inside: {
          "variable": {
            pattern: /^(!?\[)[^\]]+/,
            lookbehind: true
          },
          "string": /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/,
          "punctuation": /^[\[\]!:]|[<>]/
        },
        alias: "url"
      },
      "bold": {
        // **strong**
        // __strong__
        // allow one nested instance of italic text using the same delimiter
        pattern: createInline(/\b__(?:(?!_)<inner>|_(?:(?!_)<inner>)+_)+__\b|\*\*(?:(?!\*)<inner>|\*(?:(?!\*)<inner>)+\*)+\*\*/.source),
        lookbehind: true,
        greedy: true,
        inside: {
          "content": {
            pattern: /(^..)[\s\S]+(?=..$)/,
            lookbehind: true,
            inside: {}
            // see below
          },
          "punctuation": /\*\*|__/
        }
      },
      "italic": {
        // *em*
        // _em_
        // allow one nested instance of bold text using the same delimiter
        pattern: createInline(/\b_(?:(?!_)<inner>|__(?:(?!_)<inner>)+__)+_\b|\*(?:(?!\*)<inner>|\*\*(?:(?!\*)<inner>)+\*\*)+\*/.source),
        lookbehind: true,
        greedy: true,
        inside: {
          "content": {
            pattern: /(^.)[\s\S]+(?=.$)/,
            lookbehind: true,
            inside: {}
            // see below
          },
          "punctuation": /[*_]/
        }
      },
      "strike": {
        // ~~strike through~~
        // ~strike~
        // eslint-disable-next-line regexp/strict
        pattern: createInline(/(~~?)(?:(?!~)<inner>)+\2/.source),
        lookbehind: true,
        greedy: true,
        inside: {
          "content": {
            pattern: /(^~~?)[\s\S]+(?=\1$)/,
            lookbehind: true,
            inside: {}
            // see below
          },
          "punctuation": /~~?/
        }
      },
      "code-snippet": {
        // `code`
        // ``code``
        pattern: /(^|[^\\`])(?:``[^`\r\n]+(?:`[^`\r\n]+)*``(?!`)|`[^`\r\n]+`(?!`))/,
        lookbehind: true,
        greedy: true,
        alias: ["code", "keyword"]
      },
      "url": {
        // [example](http://example.com "Optional title")
        // [example][id]
        // [example] [id]
        pattern: createInline(/!?\[(?:(?!\])<inner>)+\](?:\([^\s)]+(?:[\t ]+"(?:\\.|[^"\\])*")?\)|[ \t]?\[(?:(?!\])<inner>)+\])/.source),
        lookbehind: true,
        greedy: true,
        inside: {
          "operator": /^!/,
          "content": {
            pattern: /(^\[)[^\]]+(?=\])/,
            lookbehind: true,
            inside: {}
            // see below
          },
          "variable": {
            pattern: /(^\][ \t]?\[)[^\]]+(?=\]$)/,
            lookbehind: true
          },
          "url": {
            pattern: /(^\]\()[^\s)]+/,
            lookbehind: true
          },
          "string": {
            pattern: /(^[ \t]+)"(?:\\.|[^"\\])*"(?=\)$)/,
            lookbehind: true
          }
        }
      }
    });
    ["url", "bold", "italic", "strike"].forEach(function(token) {
      ["url", "bold", "italic", "strike", "code-snippet"].forEach(function(inside) {
        if (token !== inside) {
          Prism2.languages.markdown[token].inside.content.inside[inside] = Prism2.languages.markdown[inside];
        }
      });
    });
    Prism2.hooks.add("after-tokenize", function(env) {
      if (env.language !== "markdown" && env.language !== "md") {
        return;
      }
      function walkTokens(tokens) {
        if (!tokens || typeof tokens === "string") {
          return;
        }
        for (var i2 = 0, l2 = tokens.length; i2 < l2; i2++) {
          var token = tokens[i2];
          if (token.type !== "code") {
            walkTokens(token.content);
            continue;
          }
          var codeLang = token.content[1];
          var codeBlock = token.content[3];
          if (codeLang && codeBlock && codeLang.type === "code-language" && codeBlock.type === "code-block" && typeof codeLang.content === "string") {
            var lang = codeLang.content.replace(/\b#/g, "sharp").replace(/\b\+\+/g, "pp");
            lang = (/[a-z][\w-]*/i.exec(lang) || [""])[0].toLowerCase();
            var alias = "language-" + lang;
            if (!codeBlock.alias) {
              codeBlock.alias = [alias];
            } else if (typeof codeBlock.alias === "string") {
              codeBlock.alias = [codeBlock.alias, alias];
            } else {
              codeBlock.alias.push(alias);
            }
          }
        }
      }
      walkTokens(env.tokens);
    });
    Prism2.hooks.add("wrap", function(env) {
      if (env.type !== "code-block") {
        return;
      }
      var codeLang = "";
      for (var i2 = 0, l2 = env.classes.length; i2 < l2; i2++) {
        var cls = env.classes[i2];
        var match = /language-(.+)/.exec(cls);
        if (match) {
          codeLang = match[1];
          break;
        }
      }
      var grammar = Prism2.languages[codeLang];
      if (!grammar) {
        if (codeLang && codeLang !== "none" && Prism2.plugins.autoloader) {
          var id = "md-" + (/* @__PURE__ */ new Date()).valueOf() + "-" + Math.floor(Math.random() * 1e16);
          env.attributes["id"] = id;
          Prism2.plugins.autoloader.loadLanguages(codeLang, function() {
            var ele = document.getElementById(id);
            if (ele) {
              ele.innerHTML = Prism2.highlight(ele.textContent, Prism2.languages[codeLang], codeLang);
            }
          });
        }
      } else {
        env.content = Prism2.highlight(textContent(env.content), grammar, codeLang);
      }
    });
    var tagPattern = RegExp(Prism2.languages.markup.tag.pattern.source, "gi");
    var KNOWN_ENTITY_NAMES = {
      "amp": "&",
      "lt": "<",
      "gt": ">",
      "quot": '"'
    };
    var fromCodePoint = String.fromCodePoint || String.fromCharCode;
    function textContent(html) {
      var text = html.replace(tagPattern, "");
      text = text.replace(/&(\w{1,8}|#x?[\da-f]{1,8});/gi, function(m2, code) {
        code = code.toLowerCase();
        if (code[0] === "#") {
          var value;
          if (code[1] === "x") {
            value = parseInt(code.slice(2), 16);
          } else {
            value = Number(code.slice(1));
          }
          return fromCodePoint(value);
        } else {
          var known = KNOWN_ENTITY_NAMES[code];
          if (known) {
            return known;
          }
          return m2;
        }
      });
      return text;
    }
    Prism2.languages.md = Prism2.languages.markdown;
  })(Prism);
  Prism.languages.c = Prism.languages.extend("clike", {
    "comment": {
      pattern: /\/\/(?:[^\r\n\\]|\\(?:\r\n?|\n|(?![\r\n])))*|\/\*[\s\S]*?(?:\*\/|$)/,
      greedy: true
    },
    "string": {
      // https://en.cppreference.com/w/c/language/string_literal
      pattern: /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
      greedy: true
    },
    "class-name": {
      pattern: /(\b(?:enum|struct)\s+(?:__attribute__\s*\(\([\s\S]*?\)\)\s*)?)\w+|\b[a-z]\w*_t\b/,
      lookbehind: true
    },
    "keyword": /\b(?:_Alignas|_Alignof|_Atomic|_Bool|_Complex|_Generic|_Imaginary|_Noreturn|_Static_assert|_Thread_local|__attribute__|asm|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|typeof|union|unsigned|void|volatile|while)\b/,
    "function": /\b[a-z_]\w*(?=\s*\()/i,
    "number": /(?:\b0x(?:[\da-f]+(?:\.[\da-f]*)?|\.[\da-f]+)(?:p[+-]?\d+)?|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?)[ful]{0,4}/i,
    "operator": />>=?|<<=?|->|([-+&|:])\1|[?:~]|[-+*/%&|^!=<>]=?/
  });
  Prism.languages.insertBefore("c", "string", {
    "char": {
      // https://en.cppreference.com/w/c/language/character_constant
      pattern: /'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n]){0,32}'/,
      greedy: true
    }
  });
  Prism.languages.insertBefore("c", "string", {
    "macro": {
      // allow for multiline macro definitions
      // spaces after the # character compile fine with gcc
      pattern: /(^[\t ]*)#\s*[a-z](?:[^\r\n\\/]|\/(?!\*)|\/\*(?:[^*]|\*(?!\/))*\*\/|\\(?:\r\n|[\s\S]))*/im,
      lookbehind: true,
      greedy: true,
      alias: "property",
      inside: {
        "string": [
          {
            // highlight the path of the include statement as a string
            pattern: /^(#\s*include\s*)<[^>]+>/,
            lookbehind: true
          },
          Prism.languages.c["string"]
        ],
        "char": Prism.languages.c["char"],
        "comment": Prism.languages.c["comment"],
        "macro-name": [
          {
            pattern: /(^#\s*define\s+)\w+\b(?!\()/i,
            lookbehind: true
          },
          {
            pattern: /(^#\s*define\s+)\w+\b(?=\()/i,
            lookbehind: true,
            alias: "function"
          }
        ],
        // highlight macro directives as keywords
        "directive": {
          pattern: /^(#\s*)[a-z]+/,
          lookbehind: true,
          alias: "keyword"
        },
        "directive-hash": /^#/,
        "punctuation": /##|\\(?=[\r\n])/,
        "expression": {
          pattern: /\S[\s\S]*/,
          inside: Prism.languages.c
        }
      }
    }
  });
  Prism.languages.insertBefore("c", "function", {
    // highlight predefined macros as constants
    "constant": /\b(?:EOF|NULL|SEEK_CUR|SEEK_END|SEEK_SET|__DATE__|__FILE__|__LINE__|__TIMESTAMP__|__TIME__|__func__|stderr|stdin|stdout)\b/
  });
  delete Prism.languages.c["boolean"];
  (function(Prism2) {
    var string = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;
    Prism2.languages.css = {
      "comment": /\/\*[\s\S]*?\*\//,
      "atrule": {
        pattern: RegExp("@[\\w-](?:" + /[^;{\s"']|\s+(?!\s)/.source + "|" + string.source + ")*?" + /(?:;|(?=\s*\{))/.source),
        inside: {
          "rule": /^@[\w-]+/,
          "selector-function-argument": {
            pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
            lookbehind: true,
            alias: "selector"
          },
          "keyword": {
            pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
            lookbehind: true
          }
          // See rest below
        }
      },
      "url": {
        // https://drafts.csswg.org/css-values-3/#urls
        pattern: RegExp("\\burl\\((?:" + string.source + "|" + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ")\\)", "i"),
        greedy: true,
        inside: {
          "function": /^url/i,
          "punctuation": /^\(|\)$/,
          "string": {
            pattern: RegExp("^" + string.source + "$"),
            alias: "url"
          }
        }
      },
      "selector": {
        pattern: RegExp(`(^|[{}\\s])[^{}\\s](?:[^{};"'\\s]|\\s+(?![\\s{])|` + string.source + ")*(?=\\s*\\{)"),
        lookbehind: true
      },
      "string": {
        pattern: string,
        greedy: true
      },
      "property": {
        pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
        lookbehind: true
      },
      "important": /!important\b/i,
      "function": {
        pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
        lookbehind: true
      },
      "punctuation": /[(){};:,]/
    };
    Prism2.languages.css["atrule"].inside.rest = Prism2.languages.css;
    var markup = Prism2.languages.markup;
    if (markup) {
      markup.tag.addInlined("style", "css");
      markup.tag.addAttribute("style", "css");
    }
  })(Prism);
  Prism.languages.objectivec = Prism.languages.extend("c", {
    "string": {
      pattern: /@?"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
      greedy: true
    },
    "keyword": /\b(?:asm|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|in|inline|int|long|register|return|self|short|signed|sizeof|static|struct|super|switch|typedef|typeof|union|unsigned|void|volatile|while)\b|(?:@interface|@end|@implementation|@protocol|@class|@public|@protected|@private|@property|@try|@catch|@finally|@throw|@synthesize|@dynamic|@selector)\b/,
    "operator": /-[->]?|\+\+?|!=?|<<?=?|>>?=?|==?|&&?|\|\|?|[~^%?*\/@]/
  });
  delete Prism.languages.objectivec["class-name"];
  Prism.languages.objc = Prism.languages.objectivec;
  Prism.languages.sql = {
    "comment": {
      pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|(?:--|\/\/|#).*)/,
      lookbehind: true
    },
    "variable": [
      {
        pattern: /@(["'`])(?:\\[\s\S]|(?!\1)[^\\])+\1/,
        greedy: true
      },
      /@[\w.$]+/
    ],
    "string": {
      pattern: /(^|[^@\\])("|')(?:\\[\s\S]|(?!\2)[^\\]|\2\2)*\2/,
      greedy: true,
      lookbehind: true
    },
    "identifier": {
      pattern: /(^|[^@\\])`(?:\\[\s\S]|[^`\\]|``)*`/,
      greedy: true,
      lookbehind: true,
      inside: {
        "punctuation": /^`|`$/
      }
    },
    "function": /\b(?:AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE)(?=\s*\()/i,
    // Should we highlight user defined functions too?
    "keyword": /\b(?:ACTION|ADD|AFTER|ALGORITHM|ALL|ALTER|ANALYZE|ANY|APPLY|AS|ASC|AUTHORIZATION|AUTO_INCREMENT|BACKUP|BDB|BEGIN|BERKELEYDB|BIGINT|BINARY|BIT|BLOB|BOOL|BOOLEAN|BREAK|BROWSE|BTREE|BULK|BY|CALL|CASCADED?|CASE|CHAIN|CHAR(?:ACTER|SET)?|CHECK(?:POINT)?|CLOSE|CLUSTERED|COALESCE|COLLATE|COLUMNS?|COMMENT|COMMIT(?:TED)?|COMPUTE|CONNECT|CONSISTENT|CONSTRAINT|CONTAINS(?:TABLE)?|CONTINUE|CONVERT|CREATE|CROSS|CURRENT(?:_DATE|_TIME|_TIMESTAMP|_USER)?|CURSOR|CYCLE|DATA(?:BASES?)?|DATE(?:TIME)?|DAY|DBCC|DEALLOCATE|DEC|DECIMAL|DECLARE|DEFAULT|DEFINER|DELAYED|DELETE|DELIMITERS?|DENY|DESC|DESCRIBE|DETERMINISTIC|DISABLE|DISCARD|DISK|DISTINCT|DISTINCTROW|DISTRIBUTED|DO|DOUBLE|DROP|DUMMY|DUMP(?:FILE)?|DUPLICATE|ELSE(?:IF)?|ENABLE|ENCLOSED|END|ENGINE|ENUM|ERRLVL|ERRORS|ESCAPED?|EXCEPT|EXEC(?:UTE)?|EXISTS|EXIT|EXPLAIN|EXTENDED|FETCH|FIELDS|FILE|FILLFACTOR|FIRST|FIXED|FLOAT|FOLLOWING|FOR(?: EACH ROW)?|FORCE|FOREIGN|FREETEXT(?:TABLE)?|FROM|FULL|FUNCTION|GEOMETRY(?:COLLECTION)?|GLOBAL|GOTO|GRANT|GROUP|HANDLER|HASH|HAVING|HOLDLOCK|HOUR|IDENTITY(?:COL|_INSERT)?|IF|IGNORE|IMPORT|INDEX|INFILE|INNER|INNODB|INOUT|INSERT|INT|INTEGER|INTERSECT|INTERVAL|INTO|INVOKER|ISOLATION|ITERATE|JOIN|KEYS?|KILL|LANGUAGE|LAST|LEAVE|LEFT|LEVEL|LIMIT|LINENO|LINES|LINESTRING|LOAD|LOCAL|LOCK|LONG(?:BLOB|TEXT)|LOOP|MATCH(?:ED)?|MEDIUM(?:BLOB|INT|TEXT)|MERGE|MIDDLEINT|MINUTE|MODE|MODIFIES|MODIFY|MONTH|MULTI(?:LINESTRING|POINT|POLYGON)|NATIONAL|NATURAL|NCHAR|NEXT|NO|NONCLUSTERED|NULLIF|NUMERIC|OFF?|OFFSETS?|ON|OPEN(?:DATASOURCE|QUERY|ROWSET)?|OPTIMIZE|OPTION(?:ALLY)?|ORDER|OUT(?:ER|FILE)?|OVER|PARTIAL|PARTITION|PERCENT|PIVOT|PLAN|POINT|POLYGON|PRECEDING|PRECISION|PREPARE|PREV|PRIMARY|PRINT|PRIVILEGES|PROC(?:EDURE)?|PUBLIC|PURGE|QUICK|RAISERROR|READS?|REAL|RECONFIGURE|REFERENCES|RELEASE|RENAME|REPEAT(?:ABLE)?|REPLACE|REPLICATION|REQUIRE|RESIGNAL|RESTORE|RESTRICT|RETURN(?:ING|S)?|REVOKE|RIGHT|ROLLBACK|ROUTINE|ROW(?:COUNT|GUIDCOL|S)?|RTREE|RULE|SAVE(?:POINT)?|SCHEMA|SECOND|SELECT|SERIAL(?:IZABLE)?|SESSION(?:_USER)?|SET(?:USER)?|SHARE|SHOW|SHUTDOWN|SIMPLE|SMALLINT|SNAPSHOT|SOME|SONAME|SQL|START(?:ING)?|STATISTICS|STATUS|STRIPED|SYSTEM_USER|TABLES?|TABLESPACE|TEMP(?:ORARY|TABLE)?|TERMINATED|TEXT(?:SIZE)?|THEN|TIME(?:STAMP)?|TINY(?:BLOB|INT|TEXT)|TOP?|TRAN(?:SACTIONS?)?|TRIGGER|TRUNCATE|TSEQUAL|TYPES?|UNBOUNDED|UNCOMMITTED|UNDEFINED|UNION|UNIQUE|UNLOCK|UNPIVOT|UNSIGNED|UPDATE(?:TEXT)?|USAGE|USE|USER|USING|VALUES?|VAR(?:BINARY|CHAR|CHARACTER|YING)|VIEW|WAITFOR|WARNINGS|WHEN|WHERE|WHILE|WITH(?: ROLLUP|IN)?|WORK|WRITE(?:TEXT)?|YEAR)\b/i,
    "boolean": /\b(?:FALSE|NULL|TRUE)\b/i,
    "number": /\b0x[\da-f]+\b|\b\d+(?:\.\d*)?|\B\.\d+\b/i,
    "operator": /[-+*\/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?|\b(?:AND|BETWEEN|DIV|ILIKE|IN|IS|LIKE|NOT|OR|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b/i,
    "punctuation": /[;[\]()`,.]/
  };
  (function(Prism2) {
    var powershell = Prism2.languages.powershell = {
      "comment": [
        {
          pattern: /(^|[^`])<#[\s\S]*?#>/,
          lookbehind: true
        },
        {
          pattern: /(^|[^`])#.*/,
          lookbehind: true
        }
      ],
      "string": [
        {
          pattern: /"(?:`[\s\S]|[^`"])*"/,
          greedy: true,
          inside: null
          // see below
        },
        {
          pattern: /'(?:[^']|'')*'/,
          greedy: true
        }
      ],
      // Matches name spaces as well as casts, attribute decorators. Force starting with letter to avoid matching array indices
      // Supports two levels of nested brackets (e.g. `[OutputType([System.Collections.Generic.List[int]])]`)
      "namespace": /\[[a-z](?:\[(?:\[[^\]]*\]|[^\[\]])*\]|[^\[\]])*\]/i,
      "boolean": /\$(?:false|true)\b/i,
      "variable": /\$\w+\b/,
      // Cmdlets and aliases. Aliases should come last, otherwise "write" gets preferred over "write-host" for example
      // Get-Command | ?{ $_.ModuleName -match "Microsoft.PowerShell.(Util|Core|Management)" }
      // Get-Alias | ?{ $_.ReferencedCommand.Module.Name -match "Microsoft.PowerShell.(Util|Core|Management)" }
      "function": [
        /\b(?:Add|Approve|Assert|Backup|Block|Checkpoint|Clear|Close|Compare|Complete|Compress|Confirm|Connect|Convert|ConvertFrom|ConvertTo|Copy|Debug|Deny|Disable|Disconnect|Dismount|Edit|Enable|Enter|Exit|Expand|Export|Find|ForEach|Format|Get|Grant|Group|Hide|Import|Initialize|Install|Invoke|Join|Limit|Lock|Measure|Merge|Move|New|Open|Optimize|Out|Ping|Pop|Protect|Publish|Push|Read|Receive|Redo|Register|Remove|Rename|Repair|Request|Reset|Resize|Resolve|Restart|Restore|Resume|Revoke|Save|Search|Select|Send|Set|Show|Skip|Sort|Split|Start|Step|Stop|Submit|Suspend|Switch|Sync|Tee|Test|Trace|Unblock|Undo|Uninstall|Unlock|Unprotect|Unpublish|Unregister|Update|Use|Wait|Watch|Where|Write)-[a-z]+\b/i,
        /\b(?:ac|cat|chdir|clc|cli|clp|clv|compare|copy|cp|cpi|cpp|cvpa|dbp|del|diff|dir|ebp|echo|epal|epcsv|epsn|erase|fc|fl|ft|fw|gal|gbp|gc|gci|gcs|gdr|gi|gl|gm|gp|gps|group|gsv|gu|gv|gwmi|iex|ii|ipal|ipcsv|ipsn|irm|iwmi|iwr|kill|lp|ls|measure|mi|mount|move|mp|mv|nal|ndr|ni|nv|ogv|popd|ps|pushd|pwd|rbp|rd|rdr|ren|ri|rm|rmdir|rni|rnp|rp|rv|rvpa|rwmi|sal|saps|sasv|sbp|sc|select|set|shcm|si|sl|sleep|sls|sort|sp|spps|spsv|start|sv|swmi|tee|trcm|type|write)\b/i
      ],
      // per http://technet.microsoft.com/en-us/library/hh847744.aspx
      "keyword": /\b(?:Begin|Break|Catch|Class|Continue|Data|Define|Do|DynamicParam|Else|ElseIf|End|Exit|Filter|Finally|For|ForEach|From|Function|If|InlineScript|Parallel|Param|Process|Return|Sequence|Switch|Throw|Trap|Try|Until|Using|Var|While|Workflow)\b/i,
      "operator": {
        pattern: /(^|\W)(?:!|-(?:b?(?:and|x?or)|as|(?:Not)?(?:Contains|In|Like|Match)|eq|ge|gt|is(?:Not)?|Join|le|lt|ne|not|Replace|sh[lr])\b|-[-=]?|\+[+=]?|[*\/%]=?)/i,
        lookbehind: true
      },
      "punctuation": /[|{}[\];(),.]/
    };
    powershell.string[0].inside = {
      "function": {
        // Allow for one level of nesting
        pattern: /(^|[^`])\$\((?:\$\([^\r\n()]*\)|(?!\$\()[^\r\n)])*\)/,
        lookbehind: true,
        inside: powershell
      },
      "boolean": powershell.boolean,
      "variable": powershell.variable
    };
  })(Prism);
  var prismPython = {};
  var hasRequiredPrismPython;
  function requirePrismPython() {
    if (hasRequiredPrismPython) return prismPython;
    hasRequiredPrismPython = 1;
    Prism.languages.python = {
      "comment": {
        pattern: /(^|[^\\])#.*/,
        lookbehind: true,
        greedy: true
      },
      "string-interpolation": {
        pattern: /(?:f|fr|rf)(?:("""|''')[\s\S]*?\1|("|')(?:\\.|(?!\2)[^\\\r\n])*\2)/i,
        greedy: true,
        inside: {
          "interpolation": {
            // "{" <expression> <optional "!s", "!r", or "!a"> <optional ":" format specifier> "}"
            pattern: /((?:^|[^{])(?:\{\{)*)\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}])+\})+\})+\}/,
            lookbehind: true,
            inside: {
              "format-spec": {
                pattern: /(:)[^:(){}]+(?=\}$)/,
                lookbehind: true
              },
              "conversion-option": {
                pattern: /![sra](?=[:}]$)/,
                alias: "punctuation"
              },
              rest: null
            }
          },
          "string": /[\s\S]+/
        }
      },
      "triple-quoted-string": {
        pattern: /(?:[rub]|br|rb)?("""|''')[\s\S]*?\1/i,
        greedy: true,
        alias: "string"
      },
      "string": {
        pattern: /(?:[rub]|br|rb)?("|')(?:\\.|(?!\1)[^\\\r\n])*\1/i,
        greedy: true
      },
      "function": {
        pattern: /((?:^|\s)def[ \t]+)[a-zA-Z_]\w*(?=\s*\()/g,
        lookbehind: true
      },
      "class-name": {
        pattern: /(\bclass\s+)\w+/i,
        lookbehind: true
      },
      "decorator": {
        pattern: /(^[\t ]*)@\w+(?:\.\w+)*/m,
        lookbehind: true,
        alias: ["annotation", "punctuation"],
        inside: {
          "punctuation": /\./
        }
      },
      "keyword": /\b(?:_(?=\s*:)|and|as|assert|async|await|break|case|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|match|nonlocal|not|or|pass|print|raise|return|try|while|with|yield)\b/,
      "builtin": /\b(?:__import__|abs|all|any|apply|ascii|basestring|bin|bool|buffer|bytearray|bytes|callable|chr|classmethod|cmp|coerce|compile|complex|delattr|dict|dir|divmod|enumerate|eval|execfile|file|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|intern|isinstance|issubclass|iter|len|list|locals|long|map|max|memoryview|min|next|object|oct|open|ord|pow|property|range|raw_input|reduce|reload|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|unichr|unicode|vars|xrange|zip)\b/,
      "boolean": /\b(?:False|None|True)\b/,
      "number": /\b0(?:b(?:_?[01])+|o(?:_?[0-7])+|x(?:_?[a-f0-9])+)\b|(?:\b\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\B\.\d+(?:_\d+)*)(?:e[+-]?\d+(?:_\d+)*)?j?(?!\w)/i,
      "operator": /[-+%=]=?|!=|:=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
      "punctuation": /[{}[\];(),.:]/
    };
    Prism.languages.python["string-interpolation"].inside["interpolation"].inside.rest = Prism.languages.python;
    Prism.languages.py = Prism.languages.python;
    return prismPython;
  }
  requirePrismPython();
  var prismRust = {};
  var hasRequiredPrismRust;
  function requirePrismRust() {
    if (hasRequiredPrismRust) return prismRust;
    hasRequiredPrismRust = 1;
    (function(Prism2) {
      var multilineComment = /\/\*(?:[^*/]|\*(?!\/)|\/(?!\*)|<self>)*\*\//.source;
      for (var i2 = 0; i2 < 2; i2++) {
        multilineComment = multilineComment.replace(/<self>/g, function() {
          return multilineComment;
        });
      }
      multilineComment = multilineComment.replace(/<self>/g, function() {
        return /[^\s\S]/.source;
      });
      Prism2.languages.rust = {
        "comment": [
          {
            pattern: RegExp(/(^|[^\\])/.source + multilineComment),
            lookbehind: true,
            greedy: true
          },
          {
            pattern: /(^|[^\\:])\/\/.*/,
            lookbehind: true,
            greedy: true
          }
        ],
        "string": {
          pattern: /b?"(?:\\[\s\S]|[^\\"])*"|b?r(#*)"(?:[^"]|"(?!\1))*"\1/,
          greedy: true
        },
        "char": {
          pattern: /b?'(?:\\(?:x[0-7][\da-fA-F]|u\{(?:[\da-fA-F]_*){1,6}\}|.)|[^\\\r\n\t'])'/,
          greedy: true
        },
        "attribute": {
          pattern: /#!?\[(?:[^\[\]"]|"(?:\\[\s\S]|[^\\"])*")*\]/,
          greedy: true,
          alias: "attr-name",
          inside: {
            "string": null
            // see below
          }
        },
        // Closure params should not be confused with bitwise OR |
        "closure-params": {
          pattern: /([=(,:]\s*|\bmove\s*)\|[^|]*\||\|[^|]*\|(?=\s*(?:\{|->))/,
          lookbehind: true,
          greedy: true,
          inside: {
            "closure-punctuation": {
              pattern: /^\||\|$/,
              alias: "punctuation"
            },
            rest: null
            // see below
          }
        },
        "lifetime-annotation": {
          pattern: /'\w+/,
          alias: "symbol"
        },
        "fragment-specifier": {
          pattern: /(\$\w+:)[a-z]+/,
          lookbehind: true,
          alias: "punctuation"
        },
        "variable": /\$\w+/,
        "function-definition": {
          pattern: /(\bfn\s+)\w+/,
          lookbehind: true,
          alias: "function"
        },
        "type-definition": {
          pattern: /(\b(?:enum|struct|trait|type|union)\s+)\w+/,
          lookbehind: true,
          alias: "class-name"
        },
        "module-declaration": [
          {
            pattern: /(\b(?:crate|mod)\s+)[a-z][a-z_\d]*/,
            lookbehind: true,
            alias: "namespace"
          },
          {
            pattern: /(\b(?:crate|self|super)\s*)::\s*[a-z][a-z_\d]*\b(?:\s*::(?:\s*[a-z][a-z_\d]*\s*::)*)?/,
            lookbehind: true,
            alias: "namespace",
            inside: {
              "punctuation": /::/
            }
          }
        ],
        "keyword": [
          // https://github.com/rust-lang/reference/blob/master/src/keywords.md
          /\b(?:Self|abstract|as|async|await|become|box|break|const|continue|crate|do|dyn|else|enum|extern|final|fn|for|if|impl|in|let|loop|macro|match|mod|move|mut|override|priv|pub|ref|return|self|static|struct|super|trait|try|type|typeof|union|unsafe|unsized|use|virtual|where|while|yield)\b/,
          // primitives and str
          // https://doc.rust-lang.org/stable/rust-by-example/primitives.html
          /\b(?:bool|char|f(?:32|64)|[ui](?:8|16|32|64|128|size)|str)\b/
        ],
        // functions can technically start with an upper-case letter, but this will introduce a lot of false positives
        // and Rust's naming conventions recommend snake_case anyway.
        // https://doc.rust-lang.org/1.0.0/style/style/naming/README.html
        "function": /\b[a-z_]\w*(?=\s*(?:::\s*<|\())/,
        "macro": {
          pattern: /\b\w+!/,
          alias: "property"
        },
        "constant": /\b[A-Z_][A-Z_\d]+\b/,
        "class-name": /\b[A-Z]\w*\b/,
        "namespace": {
          pattern: /(?:\b[a-z][a-z_\d]*\s*::\s*)*\b[a-z][a-z_\d]*\s*::(?!\s*<)/,
          inside: {
            "punctuation": /::/
          }
        },
        // Hex, oct, bin, dec numbers with visual separators and type suffix
        "number": /\b(?:0x[\dA-Fa-f](?:_?[\dA-Fa-f])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*|(?:(?:\d(?:_?\d)*)?\.)?\d(?:_?\d)*(?:[Ee][+-]?\d+)?)(?:_?(?:f32|f64|[iu](?:8|16|32|64|size)?))?\b/,
        "boolean": /\b(?:false|true)\b/,
        "punctuation": /->|\.\.=|\.{1,3}|::|[{}[\];(),:]/,
        "operator": /[-+*\/%!^]=?|=[=>]?|&[&=]?|\|[|=]?|<<?=?|>>?=?|[@?]/
      };
      Prism2.languages.rust["closure-params"].inside.rest = Prism2.languages.rust;
      Prism2.languages.rust["attribute"].inside["string"] = Prism2.languages.rust["string"];
    })(Prism);
    return prismRust;
  }
  requirePrismRust();
  Prism.languages.swift = {
    "comment": {
      // Nested comments are supported up to 2 levels
      pattern: /(^|[^\\:])(?:\/\/.*|\/\*(?:[^/*]|\/(?!\*)|\*(?!\/)|\/\*(?:[^*]|\*(?!\/))*\*\/)*\*\/)/,
      lookbehind: true,
      greedy: true
    },
    "string-literal": [
      // https://docs.swift.org/swift-book/LanguageGuide/StringsAndCharacters.html
      {
        pattern: RegExp(
          /(^|[^"#])/.source + "(?:" + /"(?:\\(?:\((?:[^()]|\([^()]*\))*\)|\r\n|[^(])|[^\\\r\n"])*"/.source + "|" + /"""(?:\\(?:\((?:[^()]|\([^()]*\))*\)|[^(])|[^\\"]|"(?!""))*"""/.source + ")" + /(?!["#])/.source
        ),
        lookbehind: true,
        greedy: true,
        inside: {
          "interpolation": {
            pattern: /(\\\()(?:[^()]|\([^()]*\))*(?=\))/,
            lookbehind: true,
            inside: null
            // see below
          },
          "interpolation-punctuation": {
            pattern: /^\)|\\\($/,
            alias: "punctuation"
          },
          "punctuation": /\\(?=[\r\n])/,
          "string": /[\s\S]+/
        }
      },
      {
        pattern: RegExp(
          /(^|[^"#])(#+)/.source + "(?:" + /"(?:\\(?:#+\((?:[^()]|\([^()]*\))*\)|\r\n|[^#])|[^\\\r\n])*?"/.source + "|" + /"""(?:\\(?:#+\((?:[^()]|\([^()]*\))*\)|[^#])|[^\\])*?"""/.source + ")\\2"
        ),
        lookbehind: true,
        greedy: true,
        inside: {
          "interpolation": {
            pattern: /(\\#+\()(?:[^()]|\([^()]*\))*(?=\))/,
            lookbehind: true,
            inside: null
            // see below
          },
          "interpolation-punctuation": {
            pattern: /^\)|\\#+\($/,
            alias: "punctuation"
          },
          "string": /[\s\S]+/
        }
      }
    ],
    "directive": {
      // directives with conditions
      pattern: RegExp(
        /#/.source + "(?:" + (/(?:elseif|if)\b/.source + "(?:[ 	]*" + /(?:![ \t]*)?(?:\b\w+\b(?:[ \t]*\((?:[^()]|\([^()]*\))*\))?|\((?:[^()]|\([^()]*\))*\))(?:[ \t]*(?:&&|\|\|))?/.source + ")+") + "|" + /(?:else|endif)\b/.source + ")"
      ),
      alias: "property",
      inside: {
        "directive-name": /^#\w+/,
        "boolean": /\b(?:false|true)\b/,
        "number": /\b\d+(?:\.\d+)*\b/,
        "operator": /!|&&|\|\||[<>]=?/,
        "punctuation": /[(),]/
      }
    },
    "literal": {
      pattern: /#(?:colorLiteral|column|dsohandle|file(?:ID|Literal|Path)?|function|imageLiteral|line)\b/,
      alias: "constant"
    },
    "other-directive": {
      pattern: /#\w+\b/,
      alias: "property"
    },
    "attribute": {
      pattern: /@\w+/,
      alias: "atrule"
    },
    "function-definition": {
      pattern: /(\bfunc\s+)\w+/,
      lookbehind: true,
      alias: "function"
    },
    "label": {
      // https://docs.swift.org/swift-book/LanguageGuide/ControlFlow.html#ID141
      pattern: /\b(break|continue)\s+\w+|\b[a-zA-Z_]\w*(?=\s*:\s*(?:for|repeat|while)\b)/,
      lookbehind: true,
      alias: "important"
    },
    "keyword": /\b(?:Any|Protocol|Self|Type|actor|as|assignment|associatedtype|associativity|async|await|break|case|catch|class|continue|convenience|default|defer|deinit|didSet|do|dynamic|else|enum|extension|fallthrough|fileprivate|final|for|func|get|guard|higherThan|if|import|in|indirect|infix|init|inout|internal|is|isolated|lazy|left|let|lowerThan|mutating|none|nonisolated|nonmutating|open|operator|optional|override|postfix|precedencegroup|prefix|private|protocol|public|repeat|required|rethrows|return|right|safe|self|set|some|static|struct|subscript|super|switch|throw|throws|try|typealias|unowned|unsafe|var|weak|where|while|willSet)\b/,
    "boolean": /\b(?:false|true)\b/,
    "nil": {
      pattern: /\bnil\b/,
      alias: "constant"
    },
    "short-argument": /\$\d+\b/,
    "omit": {
      pattern: /\b_\b/,
      alias: "keyword"
    },
    "number": /\b(?:[\d_]+(?:\.[\de_]+)?|0x[a-f0-9_]+(?:\.[a-f0-9p_]+)?|0b[01_]+|0o[0-7_]+)\b/i,
    // A class name must start with an upper-case letter and be either 1 letter long or contain a lower-case letter.
    "class-name": /\b[A-Z](?:[A-Z_\d]*[a-z]\w*)?\b/,
    "function": /\b[a-z_]\w*(?=\s*\()/i,
    "constant": /\b(?:[A-Z_]{2,}|k[A-Z][A-Za-z_]+)\b/,
    // Operators are generic in Swift. Developers can even create new operators (e.g. +++).
    // https://docs.swift.org/swift-book/ReferenceManual/zzSummaryOfTheGrammar.html#ID481
    // This regex only supports ASCII operators.
    "operator": /[-+*/%=!<>&|^~?]+|\.[.\-+*/%=!<>&|^~?]+/,
    "punctuation": /[{}[\]();,.:\\]/
  };
  Prism.languages.swift["string-literal"].forEach(function(rule) {
    rule.inside["interpolation"].inside = Prism.languages.swift;
  });
  var prismTypescript = {};
  var hasRequiredPrismTypescript;
  function requirePrismTypescript() {
    if (hasRequiredPrismTypescript) return prismTypescript;
    hasRequiredPrismTypescript = 1;
    (function(Prism2) {
      Prism2.languages.typescript = Prism2.languages.extend("javascript", {
        "class-name": {
          pattern: /(\b(?:class|extends|implements|instanceof|interface|new|type)\s+)(?!keyof\b)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?:\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>)?/,
          lookbehind: true,
          greedy: true,
          inside: null
          // see below
        },
        "builtin": /\b(?:Array|Function|Promise|any|boolean|console|never|number|string|symbol|unknown)\b/
      });
      Prism2.languages.typescript.keyword.push(
        /\b(?:abstract|declare|is|keyof|readonly|require)\b/,
        // keywords that have to be followed by an identifier
        /\b(?:asserts|infer|interface|module|namespace|type)\b(?=\s*(?:[{_$a-zA-Z\xA0-\uFFFF]|$))/,
        // This is for `import type *, {}`
        /\btype\b(?=\s*(?:[\{*]|$))/
      );
      delete Prism2.languages.typescript["parameter"];
      delete Prism2.languages.typescript["literal-property"];
      var typeInside = Prism2.languages.extend("typescript", {});
      delete typeInside["class-name"];
      Prism2.languages.typescript["class-name"].inside = typeInside;
      Prism2.languages.insertBefore("typescript", "function", {
        "decorator": {
          pattern: /@[$\w\xA0-\uFFFF]+/,
          inside: {
            "at": {
              pattern: /^@/,
              alias: "operator"
            },
            "function": /^[\s\S]+/
          }
        },
        "generic-function": {
          // e.g. foo<T extends "bar" | "baz">( ...
          pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>(?=\s*\()/,
          greedy: true,
          inside: {
            "function": /^#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*/,
            "generic": {
              pattern: /<[\s\S]+/,
              // everything after the first <
              alias: "class-name",
              inside: typeInside
            }
          }
        }
      });
      Prism2.languages.ts = Prism2.languages.typescript;
    })(Prism);
    return prismTypescript;
  }
  requirePrismTypescript();
  var prismJava = {};
  var hasRequiredPrismJava;
  function requirePrismJava() {
    if (hasRequiredPrismJava) return prismJava;
    hasRequiredPrismJava = 1;
    (function(Prism2) {
      var keywords = /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|exports|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|module|native|new|non-sealed|null|open|opens|package|permits|private|protected|provides|public|record(?!\s*[(){}[\]<>=%~.:,;?+\-*/&|^])|requires|return|sealed|short|static|strictfp|super|switch|synchronized|this|throw|throws|to|transient|transitive|try|uses|var|void|volatile|while|with|yield)\b/;
      var classNamePrefix = /(?:[a-z]\w*\s*\.\s*)*(?:[A-Z]\w*\s*\.\s*)*/.source;
      var className = {
        pattern: RegExp(/(^|[^\w.])/.source + classNamePrefix + /[A-Z](?:[\d_A-Z]*[a-z]\w*)?\b/.source),
        lookbehind: true,
        inside: {
          "namespace": {
            pattern: /^[a-z]\w*(?:\s*\.\s*[a-z]\w*)*(?:\s*\.)?/,
            inside: {
              "punctuation": /\./
            }
          },
          "punctuation": /\./
        }
      };
      Prism2.languages.java = Prism2.languages.extend("clike", {
        "string": {
          pattern: /(^|[^\\])"(?:\\.|[^"\\\r\n])*"/,
          lookbehind: true,
          greedy: true
        },
        "class-name": [
          className,
          {
            // variables, parameters, and constructor references
            // this to support class names (or generic parameters) which do not contain a lower case letter (also works for methods)
            pattern: RegExp(/(^|[^\w.])/.source + classNamePrefix + /[A-Z]\w*(?=\s+\w+\s*[;,=()]|\s*(?:\[[\s,]*\]\s*)?::\s*new\b)/.source),
            lookbehind: true,
            inside: className.inside
          },
          {
            // class names based on keyword
            // this to support class names (or generic parameters) which do not contain a lower case letter (also works for methods)
            pattern: RegExp(/(\b(?:class|enum|extends|implements|instanceof|interface|new|record|throws)\s+)/.source + classNamePrefix + /[A-Z]\w*\b/.source),
            lookbehind: true,
            inside: className.inside
          }
        ],
        "keyword": keywords,
        "function": [
          Prism2.languages.clike.function,
          {
            pattern: /(::\s*)[a-z_]\w*/,
            lookbehind: true
          }
        ],
        "number": /\b0b[01][01_]*L?\b|\b0x(?:\.[\da-f_p+-]+|[\da-f_]+(?:\.[\da-f_p+-]+)?)\b|(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.\d[\d_]*)(?:e[+-]?\d[\d_]*)?[dfl]?/i,
        "operator": {
          pattern: /(^|[^.])(?:<<=?|>>>?=?|->|--|\+\+|&&|\|\||::|[?:~]|[-+*/%&|^!=<>]=?)/m,
          lookbehind: true
        },
        "constant": /\b[A-Z][A-Z_\d]+\b/
      });
      Prism2.languages.insertBefore("java", "string", {
        "triple-quoted-string": {
          // http://openjdk.java.net/jeps/355#Description
          pattern: /"""[ \t]*[\r\n](?:(?:"|"")?(?:\\.|[^"\\]))*"""/,
          greedy: true,
          alias: "string"
        },
        "char": {
          pattern: /'(?:\\.|[^'\\\r\n]){1,6}'/,
          greedy: true
        }
      });
      Prism2.languages.insertBefore("java", "class-name", {
        "annotation": {
          pattern: /(^|[^.])@\w+(?:\s*\.\s*\w+)*/,
          lookbehind: true,
          alias: "punctuation"
        },
        "generics": {
          pattern: /<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&))*>)*>)*>)*>/,
          inside: {
            "class-name": className,
            "keyword": keywords,
            "punctuation": /[<>(),.:]/,
            "operator": /[?&|]/
          }
        },
        "import": [
          {
            pattern: RegExp(/(\bimport\s+)/.source + classNamePrefix + /(?:[A-Z]\w*|\*)(?=\s*;)/.source),
            lookbehind: true,
            inside: {
              "namespace": className.inside.namespace,
              "punctuation": /\./,
              "operator": /\*/,
              "class-name": /\w+/
            }
          },
          {
            pattern: RegExp(/(\bimport\s+static\s+)/.source + classNamePrefix + /(?:\w+|\*)(?=\s*;)/.source),
            lookbehind: true,
            alias: "static",
            inside: {
              "namespace": className.inside.namespace,
              "static": /\b\w+$/,
              "punctuation": /\./,
              "operator": /\*/,
              "class-name": /\w+/
            }
          }
        ],
        "namespace": {
          pattern: RegExp(
            /(\b(?:exports|import(?:\s+static)?|module|open|opens|package|provides|requires|to|transitive|uses|with)\s+)(?!<keyword>)[a-z]\w*(?:\.[a-z]\w*)*\.?/.source.replace(/<keyword>/g, function() {
              return keywords.source;
            })
          ),
          lookbehind: true,
          inside: {
            "punctuation": /\./
          }
        }
      });
    })(Prism);
    return prismJava;
  }
  requirePrismJava();
  var prismCpp = {};
  var hasRequiredPrismCpp;
  function requirePrismCpp() {
    if (hasRequiredPrismCpp) return prismCpp;
    hasRequiredPrismCpp = 1;
    (function(Prism2) {
      var keyword = /\b(?:alignas|alignof|asm|auto|bool|break|case|catch|char|char16_t|char32_t|char8_t|class|co_await|co_return|co_yield|compl|concept|const|const_cast|consteval|constexpr|constinit|continue|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|final|float|for|friend|goto|if|import|inline|int|int16_t|int32_t|int64_t|int8_t|long|module|mutable|namespace|new|noexcept|nullptr|operator|override|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|try|typedef|typeid|typename|uint16_t|uint32_t|uint64_t|uint8_t|union|unsigned|using|virtual|void|volatile|wchar_t|while)\b/;
      var modName = /\b(?!<keyword>)\w+(?:\s*\.\s*\w+)*\b/.source.replace(/<keyword>/g, function() {
        return keyword.source;
      });
      Prism2.languages.cpp = Prism2.languages.extend("c", {
        "class-name": [
          {
            pattern: RegExp(/(\b(?:class|concept|enum|struct|typename)\s+)(?!<keyword>)\w+/.source.replace(/<keyword>/g, function() {
              return keyword.source;
            })),
            lookbehind: true
          },
          // This is intended to capture the class name of method implementations like:
          //   void foo::bar() const {}
          // However! The `foo` in the above example could also be a namespace, so we only capture the class name if
          // it starts with an uppercase letter. This approximation should give decent results.
          /\b[A-Z]\w*(?=\s*::\s*\w+\s*\()/,
          // This will capture the class name before destructors like:
          //   Foo::~Foo() {}
          /\b[A-Z_]\w*(?=\s*::\s*~\w+\s*\()/i,
          // This also intends to capture the class name of method implementations but here the class has template
          // parameters, so it can't be a namespace (until C++ adds generic namespaces).
          /\b\w+(?=\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>\s*::\s*\w+\s*\()/
        ],
        "keyword": keyword,
        "number": {
          pattern: /(?:\b0b[01']+|\b0x(?:[\da-f']+(?:\.[\da-f']*)?|\.[\da-f']+)(?:p[+-]?[\d']+)?|(?:\b[\d']+(?:\.[\d']*)?|\B\.[\d']+)(?:e[+-]?[\d']+)?)[ful]{0,4}/i,
          greedy: true
        },
        "operator": />>=?|<<=?|->|--|\+\+|&&|\|\||[?:~]|<=>|[-+*/%&|^!=<>]=?|\b(?:and|and_eq|bitand|bitor|not|not_eq|or|or_eq|xor|xor_eq)\b/,
        "boolean": /\b(?:false|true)\b/
      });
      Prism2.languages.insertBefore("cpp", "string", {
        "module": {
          // https://en.cppreference.com/w/cpp/language/modules
          pattern: RegExp(
            /(\b(?:import|module)\s+)/.source + "(?:" + // header-name
            /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|<[^<>\r\n]*>/.source + "|" + // module name or partition or both
            /<mod-name>(?:\s*:\s*<mod-name>)?|:\s*<mod-name>/.source.replace(/<mod-name>/g, function() {
              return modName;
            }) + ")"
          ),
          lookbehind: true,
          greedy: true,
          inside: {
            "string": /^[<"][\s\S]+/,
            "operator": /:/,
            "punctuation": /\./
          }
        },
        "raw-string": {
          pattern: /R"([^()\\ ]{0,16})\([\s\S]*?\)\1"/,
          alias: "string",
          greedy: true
        }
      });
      Prism2.languages.insertBefore("cpp", "keyword", {
        "generic-function": {
          pattern: /\b(?!operator\b)[a-z_]\w*\s*<(?:[^<>]|<[^<>]*>)*>(?=\s*\()/i,
          inside: {
            "function": /^\w+/,
            "generic": {
              pattern: /<[\s\S]+/,
              alias: "class-name",
              inside: Prism2.languages.cpp
            }
          }
        }
      });
      Prism2.languages.insertBefore("cpp", "operator", {
        "double-colon": {
          pattern: /::/,
          alias: "punctuation"
        }
      });
      Prism2.languages.insertBefore("cpp", "class-name", {
        // the base clause is an optional list of parent classes
        // https://en.cppreference.com/w/cpp/language/class
        "base-clause": {
          pattern: /(\b(?:class|struct)\s+\w+\s*:\s*)[^;{}"'\s]+(?:\s+[^;{}"'\s]+)*(?=\s*[;{])/,
          lookbehind: true,
          greedy: true,
          inside: Prism2.languages.extend("cpp", {})
        }
      });
      Prism2.languages.insertBefore("inside", "double-colon", {
        // All untokenized words that are not namespaces should be class names
        "class-name": /\b[a-z_]\w*\b(?!\s*::)/i
      }, Prism2.languages.cpp["base-clause"]);
    })(Prism);
    return prismCpp;
  }
  requirePrismCpp();
  function t$2(t2) {
    return {};
  }
  const e = {}, n$1 = {}, r$2 = {}, i$1 = {}, s$2 = {}, o$5 = {}, l$2 = {}, c$3 = {}, a$4 = {}, u$7 = {}, f$3 = {}, d$3 = {}, h$5 = {}, g$6 = {}, _$3 = {}, p$7 = {}, y$4 = {}, m$7 = {}, x$5 = {}, v$3 = {}, S$3 = {}, T$3 = {}, C$3 = {}, k$4 = {}, b$4 = {}, w$5 = {}, N$3 = {}, E$6 = {}, P$2 = {}, F$2 = {}, D$4 = {}, L$4 = {}, O$4 = {}, I$3 = {}, A$4 = {}, M$5 = {}, W$1 = {}, z$2 = {}, B$3 = {}, R$3 = {}, K$1 = {}, $$2 = {}, J$4 = {}, U$4 = {}, V$2 = {}, j$1 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement, H$1 = j$1 && "documentMode" in document ? document.documentMode : null, q$1 = j$1 && /Mac|iPod|iPhone|iPad/.test(navigator.platform), Q$1 = j$1 && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent), X$1 = !(!j$1 || !("InputEvent" in window) || H$1) && "getTargetRanges" in new window.InputEvent("input"), Y$1 = j$1 && /Version\/[\d.]+.*Safari/.test(navigator.userAgent), Z$1 = j$1 && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream, G$3 = j$1 && /Android/.test(navigator.userAgent), tt = j$1 && /^(?=.*Chrome).*/i.test(navigator.userAgent), et = j$1 && G$3 && tt, nt = j$1 && /AppleWebKit\/[\d.]+/.test(navigator.userAgent) && !tt, rt = 1, it = 3, st$1 = 0, ot = 1, lt$1 = 2, ct$1 = 0, at$1 = 1, ut$1 = 2, ht$1 = 4, gt$1 = 8, mt$1 = 128, xt$1 = 112 | (3 | ht$1 | gt$1) | mt$1, vt$1 = 1, St = 2, Tt$1 = 3, Ct = 4, kt = 5, bt = 6, wt$1 = Y$1 || Z$1 || nt ? "\u00a0" : "\u200b", Nt$1 = "\n\n", Et$1 = Q$1 ? "\u00a0" : wt$1, Pt = "\u0591-\u07ff\ufb1d-\ufdfd\ufe70-\ufefc", Ft = "A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02b8\u0300-\u0590\u0800-\u1fff\u200e\u2c00-\ufb1c\ufe00-\ufe6f\ufefd-\uffff", Dt$1 = new RegExp("^[^" + Ft + "]*[" + Pt + "]"), Lt = new RegExp("^[^" + Pt + "]*[" + Ft + "]"), Ot$1 = { bold: 1, code: 16, highlight: mt$1, italic: 2, strikethrough: ht$1, subscript: 32, superscript: 64, underline: gt$1 }, It$1 = { directionless: 1, unmergeable: 2 }, At = { center: St, end: bt, justify: Ct, left: vt$1, right: Tt$1, start: kt }, Mt = { [St]: "center", [bt]: "end", [Ct]: "justify", [vt$1]: "left", [Tt$1]: "right", [kt]: "start" }, Wt = { normal: 0, segmented: 2, token: 1 }, zt = { [ct$1]: "normal", [ut$1]: "segmented", [at$1]: "token" };
  function Bt(t2) {
    return t2 && t2.__esModule && Object.prototype.hasOwnProperty.call(t2, "default") ? t2.default : t2;
  }
  var Rt = Bt((function(t2) {
    const e2 = new URLSearchParams();
    e2.append("code", t2);
    for (let t3 = 1; t3 < arguments.length; t3++) e2.append("v", arguments[t3]);
    throw Error(`Minified Lexical error #${t2}; visit https://lexical.dev/docs/error?${e2} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }));
  function Kt(...t2) {
    const e2 = [];
    for (const n2 of t2) if (n2 && "string" == typeof n2) for (const [t3] of n2.matchAll(/\S+/g)) e2.push(t3);
    return e2;
  }
  const $t = 100;
  let Jt = false, Ut = 0;
  function Vt(t2) {
    Ut = t2.timeStamp;
  }
  function jt(t2, e2, n2) {
    return e2.__lexicalLineBreak === t2 || void 0 !== t2[`__lexicalKey_${n2._key}`];
  }
  function Ht(t2, e2, n2) {
    const r2 = yn(n2._window);
    let i2 = null, s2 = null;
    null !== r2 && r2.anchorNode === t2 && (i2 = r2.anchorOffset, s2 = r2.focusOffset);
    const o2 = t2.nodeValue;
    null !== o2 && Me(e2, o2, i2, s2, false);
  }
  function qt(t2, e2, n2) {
    if (yi(t2)) {
      const e3 = t2.anchor.getNode();
      if (e3.is(n2) && t2.format !== e3.getFormat()) return false;
    }
    return e2.nodeType === it && n2.isAttached();
  }
  function Qt(t2, e2, n2) {
    Jt = true;
    const r2 = performance.now() - Ut > $t;
    try {
      hs(t2, (() => {
        const i2 = Oi() || (function(t3) {
          return t3.getEditorState().read((() => {
            const t4 = Oi();
            return null !== t4 ? t4.clone() : null;
          }));
        })(t2), s2 = /* @__PURE__ */ new Map(), o2 = t2.getRootElement(), l2 = t2._editorState, c2 = t2._blockCursorElement;
        let a2 = false, u2 = "";
        for (let n3 = 0; n3 < e2.length; n3++) {
          const f3 = e2[n3], d2 = f3.type, h2 = f3.target;
          let g2 = Ce(h2, l2);
          if (!(null === g2 && h2 !== o2 || ms(g2))) {
            if ("characterData" === d2) r2 && oi(g2) && qt(i2, h2, g2) && Ht(h2, g2, t2);
            else if ("childList" === d2) {
              a2 = true;
              const e3 = f3.addedNodes;
              for (let n5 = 0; n5 < e3.length; n5++) {
                const r4 = e3[n5], i3 = Te(r4), s3 = r4.parentNode;
                if (null != s3 && r4 !== c2 && null === i3 && ("BR" !== r4.nodeName || !jt(r4, s3, t2))) {
                  if (Q$1) {
                    const t3 = r4.innerText || r4.nodeValue;
                    t3 && (u2 += t3);
                  }
                  s3.removeChild(r4);
                }
              }
              const n4 = f3.removedNodes, r3 = n4.length;
              if (r3 > 0) {
                let e4 = 0;
                for (let i3 = 0; i3 < r3; i3++) {
                  const r4 = n4[i3];
                  ("BR" === r4.nodeName && jt(r4, h2, t2) || c2 === r4) && (h2.appendChild(r4), e4++);
                }
                r3 !== e4 && (h2 === o2 && (g2 = Ne(l2)), s2.set(h2, g2));
              }
            }
          }
        }
        if (s2.size > 0) for (const [e3, n3] of s2) if (_s(n3)) {
          const r3 = n3.getChildrenKeys();
          let i3 = e3.firstChild;
          for (let n4 = 0; n4 < r3.length; n4++) {
            const s3 = r3[n4], o3 = t2.getElementByKey(s3);
            null !== o3 && (null == i3 ? (e3.appendChild(o3), i3 = o3) : i3 !== o3 && e3.replaceChild(o3, i3), i3 = i3.nextSibling);
          }
        } else oi(n3) && n3.markDirty();
        const f2 = n2.takeRecords();
        if (f2.length > 0) {
          for (let e3 = 0; e3 < f2.length; e3++) {
            const n3 = f2[e3], r3 = n3.addedNodes, i3 = n3.target;
            for (let e4 = 0; e4 < r3.length; e4++) {
              const n4 = r3[e4], s3 = n4.parentNode;
              null == s3 || "BR" !== n4.nodeName || jt(n4, i3, t2) || s3.removeChild(n4);
            }
          }
          n2.takeRecords();
        }
        null !== i2 && (a2 && (i2.dirty = true, Ee(i2)), Q$1 && Ye(t2) && i2.insertRawText(u2));
      }));
    } finally {
      Jt = false;
    }
  }
  function Xt(t2) {
    const e2 = t2._observer;
    if (null !== e2) {
      Qt(t2, e2.takeRecords(), e2);
    }
  }
  function Yt(t2) {
    !(function(t3) {
      0 === Ut && on(t3).addEventListener("textInput", Vt, true);
    })(t2), t2._observer = new MutationObserver(((e2, n2) => {
      Qt(t2, e2, n2);
    }));
  }
  function Zt(t2, e2) {
    const n2 = t2.__mode, r2 = t2.__format, i2 = t2.__style, s2 = e2.__mode, o2 = e2.__format, l2 = e2.__style;
    return !(null !== n2 && n2 !== s2 || null !== r2 && r2 !== o2 || null !== i2 && i2 !== l2);
  }
  function Gt(t2, e2) {
    const n2 = t2.mergeWithSibling(e2), r2 = ts()._normalizedNodes;
    return r2.add(t2.__key), r2.add(e2.__key), n2;
  }
  function te$1(t2) {
    let e2, n2, r2 = t2;
    if ("" !== r2.__text || !r2.isSimpleText() || r2.isUnmergeable()) {
      for (; null !== (e2 = r2.getPreviousSibling()) && oi(e2) && e2.isSimpleText() && !e2.isUnmergeable(); ) {
        if ("" !== e2.__text) {
          if (Zt(e2, r2)) {
            r2 = Gt(e2, r2);
            break;
          }
          break;
        }
        e2.remove();
      }
      for (; null !== (n2 = r2.getNextSibling()) && oi(n2) && n2.isSimpleText() && !n2.isUnmergeable(); ) {
        if ("" !== n2.__text) {
          if (Zt(r2, n2)) {
            r2 = Gt(r2, n2);
            break;
          }
          break;
        }
        n2.remove();
      }
    } else r2.remove();
  }
  function ee(t2) {
    return ne(t2.anchor), ne(t2.focus), t2;
  }
  function ne(t2) {
    for (; "element" === t2.type; ) {
      const e2 = t2.getNode(), n2 = t2.offset;
      let r2, i2;
      if (n2 === e2.getChildrenSize() ? (r2 = e2.getChildAtIndex(n2 - 1), i2 = true) : (r2 = e2.getChildAtIndex(n2), i2 = false), oi(r2)) {
        t2.set(r2.__key, i2 ? r2.getTextContentSize() : 0, "text");
        break;
      }
      if (!_s(r2)) break;
      t2.set(r2.__key, i2 ? r2.getChildrenSize() : 0, "element");
    }
  }
  let re = 1;
  const se = "function" == typeof queueMicrotask ? queueMicrotask : (t2) => {
    Promise.resolve().then(t2);
  };
  function oe(t2) {
    const e2 = document.activeElement;
    if (null === e2) return false;
    const n2 = e2.nodeName;
    return ms(Ce(t2)) && ("INPUT" === n2 || "TEXTAREA" === n2 || "true" === e2.contentEditable && null == ue(e2));
  }
  function le(t2, e2, n2) {
    const r2 = t2.getRootElement();
    try {
      return null !== r2 && r2.contains(e2) && r2.contains(n2) && null !== e2 && !oe(e2) && ae(e2) === t2;
    } catch (t3) {
      return false;
    }
  }
  function ce(t2) {
    return t2 instanceof Ms;
  }
  function ae(t2) {
    let e2 = t2;
    for (; null != e2; ) {
      const t3 = ue(e2);
      if (ce(t3)) return t3;
      e2 = en(e2);
    }
    return null;
  }
  function ue(t2) {
    return t2 ? t2.__lexicalEditor : null;
  }
  function fe(t2) {
    return t2.isToken() || t2.isSegmented();
  }
  function de(t2) {
    return t2.nodeType === it;
  }
  function he(t2) {
    let e2 = t2;
    for (; null != e2; ) {
      if (de(e2)) return e2;
      e2 = e2.firstChild;
    }
    return null;
  }
  function ge(t2, e2, n2) {
    const r2 = Ot$1[e2];
    if (null !== n2 && (t2 & r2) == (n2 & r2)) return t2;
    let i2 = t2 ^ r2;
    return "subscript" === e2 ? i2 &= -65 : "superscript" === e2 && (i2 &= -33), i2;
  }
  function _e(t2) {
    return oi(t2) || $r(t2) || ms(t2);
  }
  function pe(t2, e2) {
    if (null != e2) return void (t2.__key = e2);
    Yi(), Zi();
    const n2 = ts(), r2 = Gi(), i2 = "" + re++;
    r2._nodeMap.set(i2, t2), _s(t2) ? n2._dirtyElements.set(i2, true) : n2._dirtyLeaves.add(i2), n2._cloneNotNeeded.add(i2), n2._dirtyType = ot, t2.__key = i2;
  }
  function ye(t2) {
    const e2 = t2.getParent();
    if (null !== e2) {
      const n2 = t2.getWritable(), r2 = e2.getWritable(), i2 = t2.getPreviousSibling(), s2 = t2.getNextSibling();
      if (null === i2) if (null !== s2) {
        const t3 = s2.getWritable();
        r2.__first = s2.__key, t3.__prev = null;
      } else r2.__first = null;
      else {
        const t3 = i2.getWritable();
        if (null !== s2) {
          const e3 = s2.getWritable();
          e3.__prev = t3.__key, t3.__next = e3.__key;
        } else t3.__next = null;
        n2.__prev = null;
      }
      if (null === s2) if (null !== i2) {
        const t3 = i2.getWritable();
        r2.__last = i2.__key, t3.__next = null;
      } else r2.__last = null;
      else {
        const t3 = s2.getWritable();
        if (null !== i2) {
          const e3 = i2.getWritable();
          e3.__next = t3.__key, t3.__prev = e3.__key;
        } else t3.__prev = null;
        n2.__next = null;
      }
      r2.__size--, n2.__parent = null;
    }
  }
  function me(t2) {
    Zi();
    const e2 = t2.getLatest(), n2 = e2.__parent, r2 = Gi(), i2 = ts(), s2 = r2._nodeMap, o2 = i2._dirtyElements;
    null !== n2 && (function(t3, e3, n3) {
      let r3 = t3;
      for (; null !== r3; ) {
        if (n3.has(r3)) return;
        const t4 = e3.get(r3);
        if (void 0 === t4) break;
        n3.set(r3, false), r3 = t4.__parent;
      }
    })(n2, s2, o2);
    const l2 = e2.__key;
    i2._dirtyType = ot, _s(t2) ? o2.set(l2, true) : i2._dirtyLeaves.add(l2);
  }
  function xe(t2) {
    Yi();
    const e2 = ts(), n2 = e2._compositionKey;
    if (t2 !== n2) {
      if (e2._compositionKey = t2, null !== n2) {
        const t3 = Se(n2);
        null !== t3 && t3.getWritable();
      }
      if (null !== t2) {
        const e3 = Se(t2);
        null !== e3 && e3.getWritable();
      }
    }
  }
  function ve() {
    if (Xi()) return null;
    return ts()._compositionKey;
  }
  function Se(t2, e2) {
    const n2 = (e2 || Gi())._nodeMap.get(t2);
    return void 0 === n2 ? null : n2;
  }
  function Te(t2, e2) {
    const n2 = t2[`__lexicalKey_${ts()._key}`];
    return void 0 !== n2 ? Se(n2, e2) : null;
  }
  function Ce(t2, e2) {
    let n2 = t2;
    for (; null != n2; ) {
      const t3 = Te(n2, e2);
      if (null !== t3) return t3;
      n2 = en(n2);
    }
    return null;
  }
  function ke(t2) {
    const e2 = t2._decorators, n2 = Object.assign({}, e2);
    return t2._pendingDecorators = n2, n2;
  }
  function be(t2) {
    return t2.read((() => we().getTextContent()));
  }
  function we() {
    return Ne(Gi());
  }
  function Ne(t2) {
    return t2._nodeMap.get("root");
  }
  function Ee(t2) {
    Yi();
    const e2 = Gi();
    null !== t2 && (t2.dirty = true, t2.setCachedNodes(null)), e2._selection = t2;
  }
  function Pe(t2) {
    const e2 = ts(), n2 = (function(t3, e3) {
      let n3 = t3;
      for (; null != n3; ) {
        const t4 = n3[`__lexicalKey_${e3._key}`];
        if (void 0 !== t4) return t4;
        n3 = en(n3);
      }
      return null;
    })(t2, e2);
    if (null === n2) {
      return t2 === e2.getRootElement() ? Se("root") : null;
    }
    return Se(n2);
  }
  function Fe(t2, e2) {
    return e2 ? t2.getTextContentSize() : 0;
  }
  function De(t2) {
    return /[\uD800-\uDBFF][\uDC00-\uDFFF]/g.test(t2);
  }
  function Le(t2) {
    const e2 = [];
    let n2 = t2;
    for (; null !== n2; ) e2.push(n2), n2 = n2._parentEditor;
    return e2;
  }
  function Oe() {
    return Math.random().toString(36).replace(/[^a-z]+/g, "").substr(0, 5);
  }
  function Ie(t2) {
    return t2.nodeType === it ? t2.nodeValue : null;
  }
  function Ae(t2, e2, n2) {
    const r2 = yn(e2._window);
    if (null === r2) return;
    const i2 = r2.anchorNode;
    let { anchorOffset: s2, focusOffset: o2 } = r2;
    if (null !== i2) {
      let e3 = Ie(i2);
      const r3 = Ce(i2);
      if (null !== e3 && oi(r3)) {
        if (e3 === wt$1 && n2) {
          const t3 = n2.length;
          e3 = n2, s2 = t3, o2 = t3;
        }
        null !== e3 && Me(r3, e3, s2, o2, t2);
      }
    }
  }
  function Me(t2, e2, n2, r2, i2) {
    let s2 = t2;
    if (s2.isAttached() && (i2 || !s2.isDirty())) {
      const o2 = s2.isComposing();
      let l2 = e2;
      (o2 || i2) && e2[e2.length - 1] === wt$1 && (l2 = e2.slice(0, -1));
      const c2 = s2.getTextContent();
      if (i2 || l2 !== c2) {
        if ("" === l2) {
          if (xe(null), Y$1 || Z$1 || nt) s2.remove();
          else {
            const t3 = ts();
            setTimeout((() => {
              t3.update((() => {
                s2.isAttached() && s2.remove();
              }));
            }), 20);
          }
          return;
        }
        const e3 = s2.getParent(), i3 = Ii(), c3 = s2.getTextContentSize(), a2 = ve(), u2 = s2.getKey();
        if (s2.isToken() || null !== a2 && u2 === a2 && !o2 || yi(i3) && (null !== e3 && !e3.canInsertTextBefore() && 0 === i3.anchor.offset || i3.anchor.key === t2.__key && 0 === i3.anchor.offset && !s2.canInsertTextBefore() && !o2 || i3.focus.key === t2.__key && i3.focus.offset === c3 && !s2.canInsertTextAfter() && !o2)) return void s2.markDirty();
        const f2 = Oi();
        if (!yi(f2) || null === n2 || null === r2) return void s2.setTextContent(l2);
        if (f2.setTextNodeRange(s2, n2, s2, r2), s2.isSegmented()) {
          const t3 = si(s2.getTextContent());
          s2.replace(t3), s2 = t3;
        }
        s2.setTextContent(l2);
      }
    }
  }
  function We(t2, e2) {
    if (e2.isSegmented()) return true;
    if (!t2.isCollapsed()) return false;
    const n2 = t2.anchor.offset, r2 = e2.getParentOrThrow(), i2 = e2.isToken();
    return 0 === n2 ? !e2.canInsertTextBefore() || !r2.canInsertTextBefore() && !e2.isComposing() || i2 || (function(t3) {
      const e3 = t3.getPreviousSibling();
      return (oi(e3) || _s(e3) && e3.isInline()) && !e3.canInsertTextAfter();
    })(e2) : n2 === e2.getTextContentSize() && (!e2.canInsertTextAfter() || !r2.canInsertTextAfter() && !e2.isComposing() || i2);
  }
  function ze(t2) {
    return "ArrowLeft" === t2;
  }
  function Be(t2) {
    return "ArrowRight" === t2;
  }
  function Re(t2, e2) {
    return q$1 ? t2 : e2;
  }
  function Ke(t2) {
    return "Enter" === t2;
  }
  function $e(t2) {
    return "Backspace" === t2;
  }
  function Je(t2) {
    return "Delete" === t2;
  }
  function Ue(t2, e2, n2) {
    return "a" === t2.toLowerCase() && Re(e2, n2);
  }
  function Ve() {
    const t2 = we();
    Ee(ee(t2.select(0, t2.getChildrenSize())));
  }
  function je(t2, e2) {
    void 0 === t2.__lexicalClassNameCache && (t2.__lexicalClassNameCache = {});
    const n2 = t2.__lexicalClassNameCache, r2 = n2[e2];
    if (void 0 !== r2) return r2;
    const i2 = t2[e2];
    if ("string" == typeof i2) {
      const t3 = Kt(i2);
      return n2[e2] = t3, t3;
    }
    return i2;
  }
  function He(t2, e2, n2, r2, i2) {
    if (0 === n2.size) return;
    const s2 = r2.__type, o2 = r2.__key, l2 = e2.get(s2);
    void 0 === l2 && Rt(33, s2);
    const c2 = l2.klass;
    let a2 = t2.get(c2);
    void 0 === a2 && (a2 = /* @__PURE__ */ new Map(), t2.set(c2, a2));
    const u2 = a2.get(o2), f2 = "destroyed" === u2 && "created" === i2;
    (void 0 === u2 || f2) && a2.set(o2, f2 ? "updated" : i2);
  }
  function qe(t2) {
    const e2 = t2.getType(), n2 = Gi();
    if (n2._readOnly) {
      const t3 = En(n2).get(e2);
      return t3 ? Array.from(t3.values()) : [];
    }
    const r2 = n2._nodeMap, i2 = [];
    for (const [, n3] of r2) n3 instanceof t2 && n3.__type === e2 && n3.isAttached() && i2.push(n3);
    return i2;
  }
  function Qe(t2, e2, n2) {
    const r2 = t2.getParent();
    let i2 = n2, s2 = t2;
    return null !== r2 && (e2 && 0 === n2 ? (i2 = s2.getIndexWithinParent(), s2 = r2) : e2 || n2 !== s2.getChildrenSize() || (i2 = s2.getIndexWithinParent() + 1, s2 = r2)), s2.getChildAtIndex(e2 ? i2 - 1 : i2);
  }
  function Xe(t2, e2) {
    const n2 = t2.offset;
    if ("element" === t2.type) {
      return Qe(t2.getNode(), e2, n2);
    }
    {
      const r2 = t2.getNode();
      if (e2 && 0 === n2 || !e2 && n2 === r2.getTextContentSize()) {
        const t3 = e2 ? r2.getPreviousSibling() : r2.getNextSibling();
        return null === t3 ? Qe(r2.getParentOrThrow(), e2, r2.getIndexWithinParent() + (e2 ? 0 : 1)) : t3;
      }
    }
    return null;
  }
  function Ye(t2) {
    const e2 = on(t2).event, n2 = e2 && e2.inputType;
    return "insertFromPaste" === n2 || "insertFromPasteAsQuotation" === n2;
  }
  function Ze(t2, e2, n2) {
    return us(t2, e2, n2);
  }
  function Ge(t2) {
    return !vs(t2) && !t2.isLastChild() && !t2.isInline();
  }
  function tn(t2, e2) {
    const n2 = t2._keyToDOMMap.get(e2);
    return void 0 === n2 && Rt(75, e2), n2;
  }
  function en(t2) {
    const e2 = t2.assignedSlot || t2.parentElement;
    return null !== e2 && 11 === e2.nodeType ? e2.host : e2;
  }
  function sn(t2, e2) {
    let n2 = t2.getParent();
    for (; null !== n2; ) {
      if (n2.is(e2)) return true;
      n2 = n2.getParent();
    }
    return false;
  }
  function on(t2) {
    const e2 = t2._window;
    return null === e2 && Rt(78), e2;
  }
  function cn(t2) {
    let e2 = t2.getParentOrThrow();
    for (; null !== e2; ) {
      if (an(e2)) return e2;
      e2 = e2.getParentOrThrow();
    }
    return e2;
  }
  function an(t2) {
    return vs(t2) || _s(t2) && t2.isShadowRoot();
  }
  function fn(t2) {
    const e2 = ts(), n2 = t2.constructor.getType(), r2 = e2._nodes.get(n2);
    void 0 === r2 && Rt(97);
    const i2 = r2.replace;
    if (null !== i2) {
      const e3 = i2(t2);
      return e3 instanceof t2.constructor || Rt(98), e3;
    }
    return t2;
  }
  function dn(t2, e2) {
    !vs(t2.getParent()) || _s(e2) || ms(e2) || Rt(99);
  }
  function gn(t2) {
    return (ms(t2) || _s(t2) && !t2.canBeEmpty()) && !t2.isInline();
  }
  function _n(t2, e2, n2) {
    n2.style.removeProperty("caret-color"), e2._blockCursorElement = null;
    const r2 = t2.parentElement;
    null !== r2 && r2.removeChild(t2);
  }
  function pn(t2, e2, n2) {
    let r2 = t2._blockCursorElement;
    if (yi(n2) && n2.isCollapsed() && "element" === n2.anchor.type && e2.contains(document.activeElement)) {
      const i2 = n2.anchor, s2 = i2.getNode(), o2 = i2.offset;
      let l2 = false, c2 = null;
      if (o2 === s2.getChildrenSize()) {
        gn(s2.getChildAtIndex(o2 - 1)) && (l2 = true);
      } else {
        const e3 = s2.getChildAtIndex(o2);
        if (gn(e3)) {
          const n3 = e3.getPreviousSibling();
          (null === n3 || gn(n3)) && (l2 = true, c2 = t2.getElementByKey(e3.__key));
        }
      }
      if (l2) {
        const n3 = t2.getElementByKey(s2.__key);
        return null === r2 && (t2._blockCursorElement = r2 = (function(t3) {
          const e3 = t3.theme, n4 = document.createElement("div");
          n4.contentEditable = "false", n4.setAttribute("data-lexical-cursor", "true");
          let r3 = e3.blockCursor;
          if (void 0 !== r3) {
            if ("string" == typeof r3) {
              const t4 = Kt(r3);
              r3 = e3.blockCursor = t4;
            }
            void 0 !== r3 && n4.classList.add(...r3);
          }
          return n4;
        })(t2._config)), e2.style.caretColor = "transparent", void (null === c2 ? n3.appendChild(r2) : n3.insertBefore(r2, c2));
      }
    }
    null !== r2 && _n(r2, t2, e2);
  }
  function yn(t2) {
    return j$1 ? (t2 || window).getSelection() : null;
  }
  function xn(t2) {
    return vn(t2) && "A" === t2.tagName;
  }
  function vn(t2) {
    return 1 === t2.nodeType;
  }
  function Sn(t2) {
    const e2 = new RegExp(/^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var|#text)$/, "i");
    return null !== t2.nodeName.match(e2);
  }
  function Tn(t2) {
    const e2 = new RegExp(/^(address|article|aside|blockquote|canvas|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hr|li|main|nav|noscript|ol|p|pre|section|table|td|tfoot|ul|video)$/, "i");
    return null !== t2.nodeName.match(e2);
  }
  function Cn(t2) {
    if (vs(t2) || ms(t2) && !t2.isInline()) return true;
    if (!_s(t2) || an(t2)) return false;
    const e2 = t2.getFirstChild(), n2 = null === e2 || $r(e2) || oi(e2) || e2.isInline();
    return !t2.isInline() && false !== t2.canBeEmpty() && n2;
  }
  function kn(t2, e2) {
    let n2 = t2;
    for (; null !== n2 && null !== n2.getParent() && !e2(n2); ) n2 = n2.getParentOrThrow();
    return e2(n2) ? n2 : null;
  }
  function bn() {
    return ts();
  }
  const wn = /* @__PURE__ */ new WeakMap(), Nn = /* @__PURE__ */ new Map();
  function En(t2) {
    if (!t2._readOnly && t2.isEmpty()) return Nn;
    t2._readOnly || Rt(192);
    let e2 = wn.get(t2);
    if (!e2) {
      e2 = /* @__PURE__ */ new Map(), wn.set(t2, e2);
      for (const [n2, r2] of t2._nodeMap) {
        const t3 = r2.__type;
        let i2 = e2.get(t3);
        i2 || (i2 = /* @__PURE__ */ new Map(), e2.set(t3, i2)), i2.set(n2, r2);
      }
    }
    return e2;
  }
  function Pn(t2) {
    const e2 = t2.constructor.clone(t2);
    return e2.afterCloneFrom(t2), e2;
  }
  function Fn(t2, e2, n2, r2, i2, s2) {
    let o2 = t2.getFirstChild();
    for (; null !== o2; ) {
      const t3 = o2.__key;
      o2.__parent === e2 && (_s(o2) && Fn(o2, t3, n2, r2, i2, s2), n2.has(t3) || s2.delete(t3), i2.push(t3)), o2 = o2.getNextSibling();
    }
  }
  let Dn, Ln, On, In, An, Mn, Wn, zn, Bn, Rn, Kn = "", $n = "", Jn = null, Un = "", Vn = "", jn = false, Hn = false, qn = null;
  function Qn(t2, e2) {
    const n2 = Wn.get(t2);
    if (null !== e2) {
      const n3 = dr(t2);
      n3.parentNode === e2 && e2.removeChild(n3);
    }
    if (zn.has(t2) || Ln._keyToDOMMap.delete(t2), _s(n2)) {
      const t3 = lr(n2, Wn);
      Xn(t3, 0, t3.length - 1, null);
    }
    void 0 !== n2 && He(Rn, On, In, n2, "destroyed");
  }
  function Xn(t2, e2, n2, r2) {
    let i2 = e2;
    for (; i2 <= n2; ++i2) {
      const e3 = t2[i2];
      void 0 !== e3 && Qn(e3, r2);
    }
  }
  function Yn(t2, e2) {
    t2.setProperty("text-align", e2);
  }
  const Zn = "40px";
  function Gn(t2, e2) {
    const n2 = Dn.theme.indent;
    if ("string" == typeof n2) {
      const r3 = t2.classList.contains(n2);
      e2 > 0 && !r3 ? t2.classList.add(n2) : e2 < 1 && r3 && t2.classList.remove(n2);
    }
    const r2 = getComputedStyle(t2).getPropertyValue("--lexical-indent-base-value") || Zn;
    t2.style.setProperty("padding-inline-start", 0 === e2 ? "" : `calc(${e2} * ${r2})`);
  }
  function tr(t2, e2) {
    const n2 = t2.style;
    0 === e2 ? Yn(n2, "") : e2 === vt$1 ? Yn(n2, "left") : e2 === St ? Yn(n2, "center") : e2 === Tt$1 ? Yn(n2, "right") : e2 === Ct ? Yn(n2, "justify") : e2 === kt ? Yn(n2, "start") : e2 === bt && Yn(n2, "end");
  }
  function er(t2, e2, n2) {
    const r2 = zn.get(t2);
    void 0 === r2 && Rt(60);
    const i2 = r2.createDOM(Dn, Ln);
    if ((function(t3, e3, n3) {
      const r3 = n3._keyToDOMMap;
      e3["__lexicalKey_" + n3._key] = t3, r3.set(t3, e3);
    })(t2, i2, Ln), oi(r2) ? i2.setAttribute("data-lexical-text", "true") : ms(r2) && i2.setAttribute("data-lexical-decorator", "true"), _s(r2)) {
      const t3 = r2.__indent, e3 = r2.__size;
      if (0 !== t3 && Gn(i2, t3), 0 !== e3) {
        const t4 = e3 - 1;
        !(function(t5, e4, n4, r3) {
          const i3 = $n;
          $n = "", nr(t5, n4, 0, e4, r3, null), sr(n4, r3), $n = i3;
        })(lr(r2, zn), t4, r2, i2);
      }
      const n3 = r2.__format;
      0 !== n3 && tr(i2, n3), r2.isInline() || ir(null, r2, i2), Ge(r2) && (Kn += Nt$1, Vn += Nt$1);
    } else {
      const e3 = r2.getTextContent();
      if (ms(r2)) {
        const e4 = r2.decorate(Ln, Dn);
        null !== e4 && ar(t2, e4), i2.contentEditable = "false";
      } else oi(r2) && (r2.isDirectionless() || ($n += e3));
      Kn += e3, Vn += e3;
    }
    if (null !== e2) if (null != n2) e2.insertBefore(i2, n2);
    else {
      const t3 = e2.__lexicalLineBreak;
      null != t3 ? e2.insertBefore(i2, t3) : e2.appendChild(i2);
    }
    return He(Rn, On, In, r2, "created"), i2;
  }
  function nr(t2, e2, n2, r2, i2, s2) {
    const o2 = Kn;
    Kn = "";
    let l2 = n2;
    for (; l2 <= r2; ++l2) {
      er(t2[l2], i2, s2);
      const e3 = zn.get(t2[l2]);
      null !== e3 && oi(e3) && (null === Jn && (Jn = e3.getFormat()), "" === Un && (Un = e3.getStyle()));
    }
    Ge(e2) && (Kn += Nt$1), i2.__lexicalTextContent = Kn, Kn = o2 + Kn;
  }
  function rr(t2, e2) {
    const n2 = e2.get(t2);
    return $r(n2) || ms(n2) && n2.isInline();
  }
  function ir(t2, e2, n2) {
    const r2 = null !== t2 && (0 === t2.__size || rr(t2.__last, Wn)), i2 = 0 === e2.__size || rr(e2.__last, zn);
    if (r2) {
      if (!i2) {
        const t3 = n2.__lexicalLineBreak;
        if (null != t3) try {
          n2.removeChild(t3);
        } catch (e3) {
          if ("object" == typeof e3 && null != e3) {
            const r3 = `${e3.toString()} Parent: ${n2.tagName}, child: ${t3.tagName}.`;
            throw new Error(r3);
          }
          throw e3;
        }
        n2.__lexicalLineBreak = null;
      }
    } else if (i2) {
      const t3 = document.createElement("br");
      n2.__lexicalLineBreak = t3, n2.appendChild(t3);
    }
  }
  function sr(t2, e2) {
    const n2 = e2.__lexicalDirTextContent, r2 = e2.__lexicalDir;
    if (n2 !== $n || r2 !== qn) {
      const n3 = "" === $n, s2 = n3 ? qn : (i2 = $n, Dt$1.test(i2) ? "rtl" : Lt.test(i2) ? "ltr" : null);
      if (s2 !== r2) {
        const i3 = e2.classList, o2 = Dn.theme;
        let l2 = null !== r2 ? o2[r2] : void 0, c2 = null !== s2 ? o2[s2] : void 0;
        if (void 0 !== l2) {
          if ("string" == typeof l2) {
            const t3 = Kt(l2);
            l2 = o2[r2] = t3;
          }
          i3.remove(...l2);
        }
        if (null === s2 || n3 && "ltr" === s2) e2.removeAttribute("dir");
        else {
          if (void 0 !== c2) {
            if ("string" == typeof c2) {
              const t3 = Kt(c2);
              c2 = o2[s2] = t3;
            }
            void 0 !== c2 && i3.add(...c2);
          }
          e2.dir = s2;
        }
        if (!Hn) {
          t2.getWritable().__dir = s2;
        }
      }
      qn = s2, e2.__lexicalDirTextContent = $n, e2.__lexicalDir = s2;
    }
    var i2;
  }
  function or(t2, e2, n2) {
    const r2 = $n;
    var i2;
    $n = "", Jn = null, Un = "", (function(t3, e3, n3) {
      const r3 = Kn, i3 = t3.__size, s2 = e3.__size;
      if (Kn = "", 1 === i3 && 1 === s2) {
        const r4 = t3.__first, i4 = e3.__first;
        if (r4 === i4) cr(r4, n3);
        else {
          const t4 = dr(r4), e4 = er(i4, null, null);
          try {
            n3.replaceChild(e4, t4);
          } catch (s4) {
            if ("object" == typeof s4 && null != s4) {
              const o2 = `${s4.toString()} Parent: ${n3.tagName}, new child: {tag: ${e4.tagName} key: ${i4}}, old child: {tag: ${t4.tagName}, key: ${r4}}.`;
              throw new Error(o2);
            }
            throw s4;
          }
          Qn(r4, null);
        }
        const s3 = zn.get(i4);
        oi(s3) && (null === Jn && (Jn = s3.getFormat()), "" === Un && (Un = s3.getStyle()));
      } else {
        const r4 = lr(t3, Wn), o2 = lr(e3, zn);
        if (0 === i3) 0 !== s2 && nr(o2, e3, 0, s2 - 1, n3, null);
        else if (0 === s2) {
          if (0 !== i3) {
            const t4 = null == n3.__lexicalLineBreak;
            Xn(r4, 0, i3 - 1, t4 ? null : n3), t4 && (n3.textContent = "");
          }
        } else !(function(t4, e4, n4, r5, i4, s3) {
          const o3 = r5 - 1, l2 = i4 - 1;
          let c2, a2, u2 = (h2 = s3, h2.firstChild), f2 = 0, d2 = 0;
          var h2;
          for (; f2 <= o3 && d2 <= l2; ) {
            const t5 = e4[f2], r6 = n4[d2];
            if (t5 === r6) u2 = ur(cr(r6, s3)), f2++, d2++;
            else {
              void 0 === c2 && (c2 = new Set(e4)), void 0 === a2 && (a2 = new Set(n4));
              const i6 = a2.has(t5), o4 = c2.has(r6);
              if (i6) if (o4) {
                const t6 = tn(Ln, r6);
                t6 === u2 ? u2 = ur(cr(r6, s3)) : (null != u2 ? s3.insertBefore(t6, u2) : s3.appendChild(t6), cr(r6, s3)), f2++, d2++;
              } else er(r6, s3, u2), d2++;
              else u2 = ur(dr(t5)), Qn(t5, s3), f2++;
            }
            const i5 = zn.get(r6);
            null !== i5 && oi(i5) && (null === Jn && (Jn = i5.getFormat()), "" === Un && (Un = i5.getStyle()));
          }
          const g2 = f2 > o3, _2 = d2 > l2;
          if (g2 && !_2) {
            const e5 = n4[l2 + 1];
            nr(n4, t4, d2, l2, s3, void 0 === e5 ? null : Ln.getElementByKey(e5));
          } else _2 && !g2 && Xn(e4, f2, o3, s3);
        })(e3, r4, o2, i3, s2, n3);
      }
      Ge(e3) && (Kn += Nt$1);
      n3.__lexicalTextContent = Kn, Kn = r3 + Kn;
    })(t2, e2, n2), sr(e2, n2), Es(i2 = e2) && null != Jn && Jn !== i2.__textFormat && !Hn && (i2.setTextFormat(Jn), i2.setTextStyle(Un)), (function(t3) {
      Es(t3) && "" !== Un && Un !== t3.__textStyle && !Hn && t3.setTextStyle(Un);
    })(e2), $n = r2;
  }
  function lr(t2, e2) {
    const n2 = [];
    let r2 = t2.__first;
    for (; null !== r2; ) {
      const t3 = e2.get(r2);
      void 0 === t3 && Rt(101), n2.push(r2), r2 = t3.__next;
    }
    return n2;
  }
  function cr(t2, e2) {
    const n2 = Wn.get(t2);
    let r2 = zn.get(t2);
    void 0 !== n2 && void 0 !== r2 || Rt(61);
    const i2 = jn || Mn.has(t2) || An.has(t2), s2 = tn(Ln, t2);
    if (n2 === r2 && !i2) {
      if (_s(n2)) {
        const t3 = s2.__lexicalTextContent;
        void 0 !== t3 && (Kn += t3, Vn += t3);
        const e3 = s2.__lexicalDirTextContent;
        void 0 !== e3 && ($n += e3);
      } else {
        const t3 = n2.getTextContent();
        oi(n2) && !n2.isDirectionless() && ($n += t3), Vn += t3, Kn += t3;
      }
      return s2;
    }
    if (n2 !== r2 && i2 && He(Rn, On, In, r2, "updated"), r2.updateDOM(n2, s2, Dn)) {
      const n3 = er(t2, null, null);
      return null === e2 && Rt(62), e2.replaceChild(n3, s2), Qn(t2, null), n3;
    }
    if (_s(n2) && _s(r2)) {
      const t3 = r2.__indent;
      t3 !== n2.__indent && Gn(s2, t3);
      const e3 = r2.__format;
      e3 !== n2.__format && tr(s2, e3), i2 && (or(n2, r2, s2), vs(r2) || r2.isInline() || ir(n2, r2, s2)), Ge(r2) && (Kn += Nt$1, Vn += Nt$1);
    } else {
      const e3 = r2.getTextContent();
      if (ms(r2)) {
        const e4 = r2.decorate(Ln, Dn);
        null !== e4 && ar(t2, e4);
      } else oi(r2) && !r2.isDirectionless() && ($n += e3);
      Kn += e3, Vn += e3;
    }
    if (!Hn && vs(r2) && r2.__cachedText !== Vn) {
      const t3 = r2.getWritable();
      t3.__cachedText = Vn, r2 = t3;
    }
    return s2;
  }
  function ar(t2, e2) {
    let n2 = Ln._pendingDecorators;
    const r2 = Ln._decorators;
    if (null === n2) {
      if (r2[t2] === e2) return;
      n2 = ke(Ln);
    }
    n2[t2] = e2;
  }
  function ur(t2) {
    let e2 = t2.nextSibling;
    return null !== e2 && e2 === Ln._blockCursorElement && (e2 = e2.nextSibling), e2;
  }
  function fr(t2, e2, n2, r2, i2, s2) {
    Kn = "", Vn = "", $n = "", jn = r2 === lt$1, qn = null, Ln = n2, Dn = n2._config, On = n2._nodes, In = Ln._listeners.mutation, An = i2, Mn = s2, Wn = t2._nodeMap, zn = e2._nodeMap, Hn = e2._readOnly, Bn = new Map(n2._keyToDOMMap);
    const o2 = /* @__PURE__ */ new Map();
    return Rn = o2, cr("root", null), Ln = void 0, On = void 0, An = void 0, Mn = void 0, Wn = void 0, zn = void 0, Dn = void 0, Bn = void 0, Rn = void 0, o2;
  }
  function dr(t2) {
    const e2 = Bn.get(t2);
    return void 0 === e2 && Rt(75, t2), e2;
  }
  const hr = Object.freeze({}), gr = 30, _r = [["keydown", function(t2, e2) {
    if (pr = t2.timeStamp, yr = t2.key, e2.isComposing()) return;
    const { key: n2, shiftKey: r2, ctrlKey: o2, metaKey: l2, altKey: c2 } = t2;
    if (Ze(e2, _$3, t2)) return;
    if (null == n2) return;
    if ((function(t3, e3, n3, r3) {
      return Be(t3) && !e3 && !r3 && !n3;
    })(n2, o2, c2, l2)) Ze(e2, p$7, t2);
    else if ((function(t3, e3, n3, r3, i2) {
      return Be(t3) && !r3 && !n3 && (e3 || i2);
    })(n2, o2, r2, c2, l2)) Ze(e2, y$4, t2);
    else if ((function(t3, e3, n3, r3) {
      return ze(t3) && !e3 && !r3 && !n3;
    })(n2, o2, c2, l2)) Ze(e2, m$7, t2);
    else if ((function(t3, e3, n3, r3, i2) {
      return ze(t3) && !r3 && !n3 && (e3 || i2);
    })(n2, o2, r2, c2, l2)) Ze(e2, x$5, t2);
    else if (/* @__PURE__ */ (function(t3, e3, n3) {
      return /* @__PURE__ */ (function(t4) {
        return "ArrowUp" === t4;
      })(t3) && !e3 && !n3;
    })(n2, o2, l2)) Ze(e2, v$3, t2);
    else if (/* @__PURE__ */ (function(t3, e3, n3) {
      return /* @__PURE__ */ (function(t4) {
        return "ArrowDown" === t4;
      })(t3) && !e3 && !n3;
    })(n2, o2, l2)) Ze(e2, S$3, t2);
    else if ((function(t3, e3) {
      return Ke(t3) && e3;
    })(n2, r2)) Cr = true, Ze(e2, T$3, t2);
    else if (/* @__PURE__ */ (function(t3) {
      return " " === t3;
    })(n2)) Ze(e2, C$3, t2);
    else if ((function(t3, e3) {
      return q$1 && e3 && "o" === t3.toLowerCase();
    })(n2, o2)) t2.preventDefault(), Cr = true, Ze(e2, s$2, true);
    else if ((function(t3, e3) {
      return Ke(t3) && !e3;
    })(n2, r2)) Cr = false, Ze(e2, T$3, t2);
    else if ((function(t3, e3, n3, r3) {
      return q$1 ? !e3 && !n3 && ($e(t3) || "h" === t3.toLowerCase() && r3) : !(r3 || e3 || n3) && $e(t3);
    })(n2, c2, l2, o2)) $e(n2) ? Ze(e2, k$4, t2) : (t2.preventDefault(), Ze(e2, i$1, true));
    else if (/* @__PURE__ */ (function(t3) {
      return "Escape" === t3;
    })(n2)) Ze(e2, b$4, t2);
    else if ((function(t3, e3, n3, r3, i2) {
      return q$1 ? !(n3 || r3 || i2) && (Je(t3) || "d" === t3.toLowerCase() && e3) : !(e3 || r3 || i2) && Je(t3);
    })(n2, o2, r2, c2, l2)) Je(n2) ? Ze(e2, w$5, t2) : (t2.preventDefault(), Ze(e2, i$1, false));
    else if ((function(t3, e3, n3) {
      return $e(t3) && (q$1 ? e3 : n3);
    })(n2, c2, o2)) t2.preventDefault(), Ze(e2, u$7, true);
    else if ((function(t3, e3, n3) {
      return Je(t3) && (q$1 ? e3 : n3);
    })(n2, c2, o2)) t2.preventDefault(), Ze(e2, u$7, false);
    else if ((function(t3, e3) {
      return q$1 && e3 && $e(t3);
    })(n2, l2)) t2.preventDefault(), Ze(e2, f$3, true);
    else if ((function(t3, e3) {
      return q$1 && e3 && Je(t3);
    })(n2, l2)) t2.preventDefault(), Ze(e2, f$3, false);
    else if ((function(t3, e3, n3, r3) {
      return "b" === t3.toLowerCase() && !e3 && Re(n3, r3);
    })(n2, c2, l2, o2)) t2.preventDefault(), Ze(e2, d$3, "bold");
    else if ((function(t3, e3, n3, r3) {
      return "u" === t3.toLowerCase() && !e3 && Re(n3, r3);
    })(n2, c2, l2, o2)) t2.preventDefault(), Ze(e2, d$3, "underline");
    else if ((function(t3, e3, n3, r3) {
      return "i" === t3.toLowerCase() && !e3 && Re(n3, r3);
    })(n2, c2, l2, o2)) t2.preventDefault(), Ze(e2, d$3, "italic");
    else if (/* @__PURE__ */ (function(t3, e3, n3, r3) {
      return "Tab" === t3 && !e3 && !n3 && !r3;
    })(n2, c2, o2, l2)) Ze(e2, N$3, t2);
    else if ((function(t3, e3, n3, r3) {
      return "z" === t3.toLowerCase() && !e3 && Re(n3, r3);
    })(n2, r2, l2, o2)) t2.preventDefault(), Ze(e2, h$5, void 0);
    else if ((function(t3, e3, n3, r3) {
      return q$1 ? "z" === t3.toLowerCase() && n3 && e3 : "y" === t3.toLowerCase() && r3 || "z" === t3.toLowerCase() && r3 && e3;
    })(n2, r2, l2, o2)) t2.preventDefault(), Ze(e2, g$6, void 0);
    else {
      xi(e2._editorState._selection) ? !(function(t3, e3, n3, r3) {
        return !e3 && "c" === t3.toLowerCase() && (q$1 ? n3 : r3);
      })(n2, r2, l2, o2) ? !(function(t3, e3, n3, r3) {
        return !e3 && "x" === t3.toLowerCase() && (q$1 ? n3 : r3);
      })(n2, r2, l2, o2) ? Ue(n2, l2, o2) && (t2.preventDefault(), Ze(e2, z$2, t2)) : (t2.preventDefault(), Ze(e2, W$1, t2)) : (t2.preventDefault(), Ze(e2, M$5, t2)) : !Q$1 && Ue(n2, l2, o2) && (t2.preventDefault(), Ze(e2, z$2, t2));
    }
    /* @__PURE__ */ (function(t3, e3, n3, r3) {
      return t3 || e3 || n3 || r3;
    })(o2, r2, c2, l2) && Ze(e2, V$2, t2);
  }], ["pointerdown", function(t2, e2) {
    const n2 = t2.target, r2 = t2.pointerType;
    n2 instanceof Node && "touch" !== r2 && hs(e2, (() => {
      ms(Ce(n2)) || (Tr = true);
    }));
  }], ["compositionstart", function(t2, e2) {
    hs(e2, (() => {
      const n2 = Oi();
      if (yi(n2) && !e2.isComposing()) {
        const r2 = n2.anchor, i2 = n2.anchor.getNode();
        xe(r2.key), (t2.timeStamp < pr + gr || "element" === r2.type || !n2.isCollapsed() || i2.getFormat() !== n2.format || oi(i2) && i2.getStyle() !== n2.style) && Ze(e2, l$2, Et$1);
      }
    }));
  }], ["compositionend", function(t2, e2) {
    Q$1 ? kr = true : hs(e2, (() => {
      Fr(e2, t2.data);
    }));
  }], ["input", function(t2, e2) {
    t2.stopPropagation(), hs(e2, (() => {
      const n2 = Oi(), r2 = t2.data, i2 = Pr(t2);
      if (null != r2 && yi(n2) && wr(n2, i2, r2, t2.timeStamp, false)) {
        kr && (Fr(e2, r2), kr = false);
        const i3 = n2.anchor.getNode(), s2 = yn(e2._window);
        if (null === s2) return;
        const o2 = n2.isBackward(), c2 = o2 ? n2.anchor.offset : n2.focus.offset, a2 = o2 ? n2.focus.offset : n2.anchor.offset;
        X$1 && !n2.isCollapsed() && oi(i3) && null !== s2.anchorNode && i3.getTextContent().slice(0, c2) + r2 + i3.getTextContent().slice(c2 + a2) === Ie(s2.anchorNode) || Ze(e2, l$2, r2);
        const u2 = r2.length;
        Q$1 && u2 > 1 && "insertCompositionText" === t2.inputType && !e2.isComposing() && (n2.anchor.offset -= u2), Y$1 || Z$1 || nt || !e2.isComposing() || (pr = 0, xe(null));
      } else {
        Ae(false, e2, null !== r2 ? r2 : void 0), kr && (Fr(e2, r2 || void 0), kr = false);
      }
      Yi(), Xt(ts());
    })), xr = null;
  }], ["click", function(t2, e2) {
    hs(e2, (() => {
      const n2 = Oi(), i2 = yn(e2._window), s2 = Ii();
      if (i2) {
        if (yi(n2)) {
          const e3 = n2.anchor, r2 = e3.getNode();
          if ("element" === e3.type && 0 === e3.offset && n2.isCollapsed() && !vs(r2) && 1 === we().getChildrenSize() && r2.getTopLevelElementOrThrow().isEmpty() && null !== s2 && n2.is(s2)) i2.removeAllRanges(), n2.dirty = true;
          else if (3 === t2.detail && !n2.isCollapsed()) {
            r2 !== n2.focus.getNode() && (_s(r2) ? r2.select(0) : r2.getParentOrThrow().select(0));
          }
        } else if ("touch" === t2.pointerType) {
          const n3 = i2.anchorNode;
          if (null !== n3) {
            const r2 = n3.nodeType;
            if (r2 === rt || r2 === it) {
              Ee(Li(s2, i2, e2, t2));
            }
          }
        }
      }
      Ze(e2, r$2, t2);
    }));
  }], ["cut", hr], ["copy", hr], ["dragstart", hr], ["dragover", hr], ["dragend", hr], ["paste", hr], ["focus", hr], ["blur", hr], ["drop", hr]];
  X$1 && _r.push(["beforeinput", (t2, e2) => (function(t3, e3) {
    const n2 = t3.inputType, r2 = Pr(t3);
    if ("deleteCompositionText" === n2 || Q$1 && Ye(e3)) return;
    if ("insertCompositionText" === n2) return;
    hs(e3, (() => {
      const _2 = Oi();
      if ("deleteContentBackward" === n2) {
        if (null === _2) {
          const t4 = Ii();
          if (!yi(t4)) return;
          Ee(t4.clone());
        }
        if (yi(_2)) {
          const n3 = _2.anchor.key === _2.focus.key;
          if (p2 = t3.timeStamp, "MediaLast" === yr && p2 < pr + gr && e3.isComposing() && n3) {
            if (xe(null), pr = 0, setTimeout((() => {
              hs(e3, (() => {
                xe(null);
              }));
            }), gr), yi(_2)) {
              const t4 = _2.anchor.getNode();
              t4.markDirty(), _2.format = t4.getFormat(), oi(t4) || Rt(142), _2.style = t4.getStyle();
            }
          } else {
            xe(null), t3.preventDefault();
            const r3 = _2.anchor.getNode().getTextContent(), s2 = 0 === _2.anchor.offset && _2.focus.offset === r3.length;
            et && n3 && !s2 || Ze(e3, i$1, true);
          }
          return;
        }
      }
      var p2;
      if (!yi(_2)) return;
      const y2 = t3.data;
      null !== xr && Ae(false, e3, xr), _2.dirty && null === xr || !_2.isCollapsed() || vs(_2.anchor.getNode()) || null === r2 || _2.applyDOMRange(r2), xr = null;
      const m2 = _2.anchor, x2 = _2.focus, v2 = m2.getNode(), S2 = x2.getNode();
      if ("insertText" !== n2 && "insertTranspose" !== n2) switch (t3.preventDefault(), n2) {
        case "insertFromYank":
        case "insertFromDrop":
        case "insertReplacementText":
          Ze(e3, l$2, t3);
          break;
        case "insertFromComposition":
          xe(null), Ze(e3, l$2, t3);
          break;
        case "insertLineBreak":
          xe(null), Ze(e3, s$2, false);
          break;
        case "insertParagraph":
          xe(null), Cr && !Z$1 ? (Cr = false, Ze(e3, s$2, false)) : Ze(e3, o$5, void 0);
          break;
        case "insertFromPaste":
        case "insertFromPasteAsQuotation":
          Ze(e3, c$3, t3);
          break;
        case "deleteByComposition":
          (function(t4, e4) {
            return t4 !== e4 || _s(t4) || _s(e4) || !t4.isToken() || !e4.isToken();
          })(v2, S2) && Ze(e3, a$4, t3);
          break;
        case "deleteByDrag":
        case "deleteByCut":
          Ze(e3, a$4, t3);
          break;
        case "deleteContent":
          Ze(e3, i$1, false);
          break;
        case "deleteWordBackward":
          Ze(e3, u$7, true);
          break;
        case "deleteWordForward":
          Ze(e3, u$7, false);
          break;
        case "deleteHardLineBackward":
        case "deleteSoftLineBackward":
          Ze(e3, f$3, true);
          break;
        case "deleteContentForward":
        case "deleteHardLineForward":
        case "deleteSoftLineForward":
          Ze(e3, f$3, false);
          break;
        case "formatStrikeThrough":
          Ze(e3, d$3, "strikethrough");
          break;
        case "formatBold":
          Ze(e3, d$3, "bold");
          break;
        case "formatItalic":
          Ze(e3, d$3, "italic");
          break;
        case "formatUnderline":
          Ze(e3, d$3, "underline");
          break;
        case "historyUndo":
          Ze(e3, h$5, void 0);
          break;
        case "historyRedo":
          Ze(e3, g$6, void 0);
      }
      else {
        if ("\n" === y2) t3.preventDefault(), Ze(e3, s$2, false);
        else if (y2 === Nt$1) t3.preventDefault(), Ze(e3, o$5, void 0);
        else if (null == y2 && t3.dataTransfer) {
          const e4 = t3.dataTransfer.getData("text/plain");
          t3.preventDefault(), _2.insertRawText(e4);
        } else null != y2 && wr(_2, r2, y2, t3.timeStamp, true) ? (t3.preventDefault(), Ze(e3, l$2, y2)) : xr = y2;
        mr = t3.timeStamp;
      }
    }));
  })(t2, e2)]);
  let pr = 0, yr = null, mr = 0, xr = null;
  const vr = /* @__PURE__ */ new WeakMap();
  let Sr = false, Tr = false, Cr = false, kr = false, br = [0, "", 0, "root", 0];
  function wr(t2, e2, n2, r2, i2) {
    const s2 = t2.anchor, o2 = t2.focus, l2 = s2.getNode(), c2 = ts(), a2 = yn(c2._window), u2 = null !== a2 ? a2.anchorNode : null, f2 = s2.key, d2 = c2.getElementByKey(f2), h2 = n2.length;
    return f2 !== o2.key || !oi(l2) || (!i2 && (!X$1 || mr < r2 + 50) || l2.isDirty() && h2 < 2 || De(n2)) && s2.offset !== o2.offset && !l2.isComposing() || fe(l2) || l2.isDirty() && h2 > 1 || (i2 || !X$1) && null !== d2 && !l2.isComposing() && u2 !== he(d2) || null !== a2 && null !== e2 && (!e2.collapsed || e2.startContainer !== a2.anchorNode || e2.startOffset !== a2.anchorOffset) || l2.getFormat() !== t2.format || l2.getStyle() !== t2.style || We(t2, l2);
  }
  function Nr(t2, e2) {
    return null !== t2 && null !== t2.nodeValue && t2.nodeType === it && 0 !== e2 && e2 !== t2.nodeValue.length;
  }
  function Er(t2, n2, r2) {
    const { anchorNode: i2, anchorOffset: s2, focusNode: o2, focusOffset: l2 } = t2;
    Sr && (Sr = false, Nr(i2, s2) && Nr(o2, l2)) || hs(n2, (() => {
      if (!r2) return void Ee(null);
      if (!le(n2, i2, o2)) return;
      const c2 = Oi();
      if (yi(c2)) {
        const e2 = c2.anchor, r3 = e2.getNode();
        if (c2.isCollapsed()) {
          "Range" === t2.type && t2.anchorNode === t2.focusNode && (c2.dirty = true);
          const i3 = on(n2).event, s3 = i3 ? i3.timeStamp : performance.now(), [o3, l3, a2, u2, f2] = br, d2 = we(), h2 = false === n2.isComposing() && "" === d2.getTextContent();
          if (s3 < f2 + 200 && e2.offset === a2 && e2.key === u2) c2.format = o3, c2.style = l3;
          else if ("text" === e2.type) oi(r3) || Rt(141), c2.format = r3.getFormat(), c2.style = r3.getStyle();
          else if ("element" === e2.type && !h2) {
            const t3 = e2.getNode();
            c2.style = "", t3 instanceof bs && 0 === t3.getChildrenSize() ? (c2.format = t3.getTextFormat(), c2.style = t3.getTextStyle()) : c2.format = 0;
          }
        } else {
          const t3 = e2.key, n3 = c2.focus.key, r4 = c2.getNodes(), i3 = r4.length, o3 = c2.isBackward(), a2 = o3 ? l2 : s2, u2 = o3 ? s2 : l2, f2 = o3 ? n3 : t3, d2 = o3 ? t3 : n3;
          let h2 = xt$1, g2 = false;
          for (let t4 = 0; t4 < i3; t4++) {
            const e3 = r4[t4], n4 = e3.getTextContentSize();
            if (oi(e3) && 0 !== n4 && !(0 === t4 && e3.__key === f2 && a2 === n4 || t4 === i3 - 1 && e3.__key === d2 && 0 === u2) && (g2 = true, h2 &= e3.getFormat(), 0 === h2)) break;
          }
          c2.format = g2 ? h2 : 0;
        }
      }
      Ze(n2, e, void 0);
    }));
  }
  function Pr(t2) {
    if (!t2.getTargetRanges) return null;
    const e2 = t2.getTargetRanges();
    return 0 === e2.length ? null : e2[0];
  }
  function Fr(t2, e2) {
    const n2 = t2._compositionKey;
    if (xe(null), null !== n2 && null != e2) {
      if ("" === e2) {
        const e3 = Se(n2), r2 = he(t2.getElementByKey(n2));
        return void (null !== r2 && null !== r2.nodeValue && oi(e3) && Me(e3, r2.nodeValue, null, null, true));
      }
      if ("\n" === e2[e2.length - 1]) {
        const e3 = Oi();
        if (yi(e3)) {
          const n3 = e3.focus;
          return e3.anchor.set(n3.key, n3.offset, n3.type), void Ze(t2, T$3, null);
        }
      }
    }
    Ae(true, t2, e2);
  }
  function Dr(t2) {
    let e2 = t2.__lexicalEventHandles;
    return void 0 === e2 && (e2 = [], t2.__lexicalEventHandles = e2), e2;
  }
  const Lr = /* @__PURE__ */ new Map();
  function Or(t2) {
    const e2 = t2.target, n2 = yn(null == e2 ? null : 9 === e2.nodeType ? e2.defaultView : e2.ownerDocument.defaultView);
    if (null === n2) return;
    const r2 = ae(n2.anchorNode);
    if (null === r2) return;
    Tr && (Tr = false, hs(r2, (() => {
      const e3 = Ii(), i3 = n2.anchorNode;
      if (null === i3) return;
      const s3 = i3.nodeType;
      if (s3 !== rt && s3 !== it) return;
      Ee(Li(e3, n2, r2, t2));
    })));
    const i2 = Le(r2), s2 = i2[i2.length - 1], o2 = s2._key, l2 = Lr.get(o2), c2 = l2 || s2;
    c2 !== r2 && Er(n2, c2, false), Er(n2, r2, true), r2 !== s2 ? Lr.set(o2, r2) : l2 && Lr.delete(o2);
  }
  function Ir(t2) {
    t2._lexicalHandled = true;
  }
  function Ar(t2) {
    return true === t2._lexicalHandled;
  }
  function Mr(t2) {
    const e2 = t2.ownerDocument, n2 = vr.get(e2);
    void 0 === n2 && Rt(162);
    const r2 = n2 - 1;
    r2 >= 0 || Rt(164), vr.set(e2, r2), 0 === r2 && e2.removeEventListener("selectionchange", Or);
    const i2 = ue(t2);
    ce(i2) ? (!(function(t3) {
      if (null !== t3._parentEditor) {
        const e3 = Le(t3), n3 = e3[e3.length - 1]._key;
        Lr.get(n3) === t3 && Lr.delete(n3);
      } else Lr.delete(t3._key);
    })(i2), t2.__lexicalEditor = null) : i2 && Rt(198);
    const s2 = Dr(t2);
    for (let t3 = 0; t3 < s2.length; t3++) s2[t3]();
    t2.__lexicalEventHandles = [];
  }
  function Wr(t2, e2, n2) {
    Yi();
    const r2 = t2.__key, i2 = t2.getParent();
    if (null === i2) return;
    const s2 = (function(t3) {
      const e3 = Oi();
      if (!yi(e3) || !_s(t3)) return e3;
      const { anchor: n3, focus: r3 } = e3, i3 = n3.getNode(), s3 = r3.getNode();
      return sn(i3, t3) && n3.set(t3.__key, 0, "element"), sn(s3, t3) && r3.set(t3.__key, 0, "element"), e3;
    })(t2);
    let o2 = false;
    if (yi(s2) && e2) {
      const e3 = s2.anchor, n3 = s2.focus;
      e3.key === r2 && (Wi(e3, t2, i2, t2.getPreviousSibling(), t2.getNextSibling()), o2 = true), n3.key === r2 && (Wi(n3, t2, i2, t2.getPreviousSibling(), t2.getNextSibling()), o2 = true);
    } else xi(s2) && e2 && t2.isSelected() && t2.selectPrevious();
    if (yi(s2) && e2 && !o2) {
      const e3 = t2.getIndexWithinParent();
      ye(t2), Ai(s2, i2, e3, -1);
    } else ye(t2);
    n2 || an(i2) || i2.canBeEmpty() || !i2.isEmpty() || Wr(i2, e2), e2 && vs(i2) && i2.isEmpty() && i2.selectEnd();
  }
  class zr {
    static getType() {
      Rt(64, this.name);
    }
    static clone(t2) {
      Rt(65, this.name);
    }
    afterCloneFrom(t2) {
      this.__parent = t2.__parent, this.__next = t2.__next, this.__prev = t2.__prev;
    }
    constructor(t2) {
      this.__type = this.constructor.getType(), this.__parent = null, this.__prev = null, this.__next = null, pe(this, t2);
    }
    getType() {
      return this.__type;
    }
    isInline() {
      Rt(137, this.constructor.name);
    }
    isAttached() {
      let t2 = this.__key;
      for (; null !== t2; ) {
        if ("root" === t2) return true;
        const e2 = Se(t2);
        if (null === e2) break;
        t2 = e2.__parent;
      }
      return false;
    }
    isSelected(t2) {
      const e2 = t2 || Oi();
      if (null == e2) return false;
      const n2 = e2.getNodes().some(((t3) => t3.__key === this.__key));
      if (oi(this)) return n2;
      if (yi(e2) && "element" === e2.anchor.type && "element" === e2.focus.type) {
        if (e2.isCollapsed()) return false;
        const t3 = this.getParent();
        if (ms(this) && this.isInline() && t3) {
          const n3 = e2.isBackward() ? e2.focus : e2.anchor, r2 = n3.getNode();
          if (n3.offset === r2.getChildrenSize() && r2.is(t3) && r2.getLastChildOrThrow().is(this)) return false;
        }
      }
      return n2;
    }
    getKey() {
      return this.__key;
    }
    getIndexWithinParent() {
      const t2 = this.getParent();
      if (null === t2) return -1;
      let e2 = t2.getFirstChild(), n2 = 0;
      for (; null !== e2; ) {
        if (this.is(e2)) return n2;
        n2++, e2 = e2.getNextSibling();
      }
      return -1;
    }
    getParent() {
      const t2 = this.getLatest().__parent;
      return null === t2 ? null : Se(t2);
    }
    getParentOrThrow() {
      const t2 = this.getParent();
      return null === t2 && Rt(66, this.__key), t2;
    }
    getTopLevelElement() {
      let t2 = this;
      for (; null !== t2; ) {
        const e2 = t2.getParent();
        if (an(e2)) return _s(t2) || t2 === this && ms(t2) || Rt(194), t2;
        t2 = e2;
      }
      return null;
    }
    getTopLevelElementOrThrow() {
      const t2 = this.getTopLevelElement();
      return null === t2 && Rt(67, this.__key), t2;
    }
    getParents() {
      const t2 = [];
      let e2 = this.getParent();
      for (; null !== e2; ) t2.push(e2), e2 = e2.getParent();
      return t2;
    }
    getParentKeys() {
      const t2 = [];
      let e2 = this.getParent();
      for (; null !== e2; ) t2.push(e2.__key), e2 = e2.getParent();
      return t2;
    }
    getPreviousSibling() {
      const t2 = this.getLatest().__prev;
      return null === t2 ? null : Se(t2);
    }
    getPreviousSiblings() {
      const t2 = [], e2 = this.getParent();
      if (null === e2) return t2;
      let n2 = e2.getFirstChild();
      for (; null !== n2 && !n2.is(this); ) t2.push(n2), n2 = n2.getNextSibling();
      return t2;
    }
    getNextSibling() {
      const t2 = this.getLatest().__next;
      return null === t2 ? null : Se(t2);
    }
    getNextSiblings() {
      const t2 = [];
      let e2 = this.getNextSibling();
      for (; null !== e2; ) t2.push(e2), e2 = e2.getNextSibling();
      return t2;
    }
    getCommonAncestor(t2) {
      const e2 = this.getParents(), n2 = t2.getParents();
      _s(this) && e2.unshift(this), _s(t2) && n2.unshift(t2);
      const r2 = e2.length, i2 = n2.length;
      if (0 === r2 || 0 === i2 || e2[r2 - 1] !== n2[i2 - 1]) return null;
      const s2 = new Set(n2);
      for (let t3 = 0; t3 < r2; t3++) {
        const n3 = e2[t3];
        if (s2.has(n3)) return n3;
      }
      return null;
    }
    is(t2) {
      return null != t2 && this.__key === t2.__key;
    }
    isBefore(t2) {
      if (this === t2) return false;
      if (t2.isParentOf(this)) return true;
      if (this.isParentOf(t2)) return false;
      const e2 = this.getCommonAncestor(t2);
      let n2 = 0, r2 = 0, i2 = this;
      for (; ; ) {
        const t3 = i2.getParentOrThrow();
        if (t3 === e2) {
          n2 = i2.getIndexWithinParent();
          break;
        }
        i2 = t3;
      }
      for (i2 = t2; ; ) {
        const t3 = i2.getParentOrThrow();
        if (t3 === e2) {
          r2 = i2.getIndexWithinParent();
          break;
        }
        i2 = t3;
      }
      return n2 < r2;
    }
    isParentOf(t2) {
      const e2 = this.__key;
      if (e2 === t2.__key) return false;
      let n2 = t2;
      for (; null !== n2; ) {
        if (n2.__key === e2) return true;
        n2 = n2.getParent();
      }
      return false;
    }
    getNodesBetween(t2) {
      const e2 = this.isBefore(t2), n2 = [], r2 = /* @__PURE__ */ new Set();
      let i2 = this;
      for (; null !== i2; ) {
        const s2 = i2.__key;
        if (r2.has(s2) || (r2.add(s2), n2.push(i2)), i2 === t2) break;
        const o2 = _s(i2) ? e2 ? i2.getFirstChild() : i2.getLastChild() : null;
        if (null !== o2) {
          i2 = o2;
          continue;
        }
        const l2 = e2 ? i2.getNextSibling() : i2.getPreviousSibling();
        if (null !== l2) {
          i2 = l2;
          continue;
        }
        const c2 = i2.getParentOrThrow();
        if (r2.has(c2.__key) || n2.push(c2), c2 === t2) break;
        let a2 = null, u2 = c2;
        do {
          if (null === u2 && Rt(68), a2 = e2 ? u2.getNextSibling() : u2.getPreviousSibling(), u2 = u2.getParent(), null === u2) break;
          null !== a2 || r2.has(u2.__key) || n2.push(u2);
        } while (null === a2);
        i2 = a2;
      }
      return e2 || n2.reverse(), n2;
    }
    isDirty() {
      const t2 = ts()._dirtyLeaves;
      return null !== t2 && t2.has(this.__key);
    }
    getLatest() {
      const t2 = Se(this.__key);
      return null === t2 && Rt(113), t2;
    }
    getWritable() {
      Yi();
      const t2 = Gi(), e2 = ts(), n2 = t2._nodeMap, r2 = this.__key, i2 = this.getLatest(), s2 = e2._cloneNotNeeded, o2 = Oi();
      if (null !== o2 && o2.setCachedNodes(null), s2.has(r2)) return me(i2), i2;
      const l2 = Pn(i2);
      return s2.add(r2), me(l2), n2.set(r2, l2), l2;
    }
    getTextContent() {
      return "";
    }
    getTextContentSize() {
      return this.getTextContent().length;
    }
    createDOM(t2, e2) {
      Rt(70);
    }
    updateDOM(t2, e2, n2) {
      Rt(71);
    }
    exportDOM(t2) {
      return { element: this.createDOM(t2._config, t2) };
    }
    exportJSON() {
      Rt(72);
    }
    static importJSON(t2) {
      Rt(18, this.name);
    }
    static transform() {
      return null;
    }
    remove(t2) {
      Wr(this, true, t2);
    }
    replace(t2, e2) {
      Yi();
      let n2 = Oi();
      null !== n2 && (n2 = n2.clone()), dn(this, t2);
      const r2 = this.getLatest(), i2 = this.__key, s2 = t2.__key, o2 = t2.getWritable(), l2 = this.getParentOrThrow().getWritable(), c2 = l2.__size;
      ye(o2);
      const a2 = r2.getPreviousSibling(), u2 = r2.getNextSibling(), f2 = r2.__prev, d2 = r2.__next, h2 = r2.__parent;
      if (Wr(r2, false, true), null === a2) l2.__first = s2;
      else {
        a2.getWritable().__next = s2;
      }
      if (o2.__prev = f2, null === u2) l2.__last = s2;
      else {
        u2.getWritable().__prev = s2;
      }
      if (o2.__next = d2, o2.__parent = h2, l2.__size = c2, e2 && (_s(this) && _s(o2) || Rt(139), this.getChildren().forEach(((t3) => {
        o2.append(t3);
      }))), yi(n2)) {
        Ee(n2);
        const t3 = n2.anchor, e3 = n2.focus;
        t3.key === i2 && gi(t3, o2), e3.key === i2 && gi(e3, o2);
      }
      return ve() === i2 && xe(s2), o2;
    }
    insertAfter(t2, e2 = true) {
      Yi(), dn(this, t2);
      const n2 = this.getWritable(), r2 = t2.getWritable(), i2 = r2.getParent(), s2 = Oi();
      let o2 = false, l2 = false;
      if (null !== i2) {
        const e3 = t2.getIndexWithinParent();
        if (ye(r2), yi(s2)) {
          const t3 = i2.__key, n3 = s2.anchor, r3 = s2.focus;
          o2 = "element" === n3.type && n3.key === t3 && n3.offset === e3 + 1, l2 = "element" === r3.type && r3.key === t3 && r3.offset === e3 + 1;
        }
      }
      const c2 = this.getNextSibling(), a2 = this.getParentOrThrow().getWritable(), u2 = r2.__key, f2 = n2.__next;
      if (null === c2) a2.__last = u2;
      else {
        c2.getWritable().__prev = u2;
      }
      if (a2.__size++, n2.__next = u2, r2.__next = f2, r2.__prev = n2.__key, r2.__parent = n2.__parent, e2 && yi(s2)) {
        const t3 = this.getIndexWithinParent();
        Ai(s2, a2, t3 + 1);
        const e3 = a2.__key;
        o2 && s2.anchor.set(e3, t3 + 2, "element"), l2 && s2.focus.set(e3, t3 + 2, "element");
      }
      return t2;
    }
    insertBefore(t2, e2 = true) {
      Yi(), dn(this, t2);
      const n2 = this.getWritable(), r2 = t2.getWritable(), i2 = r2.__key;
      ye(r2);
      const s2 = this.getPreviousSibling(), o2 = this.getParentOrThrow().getWritable(), l2 = n2.__prev, c2 = this.getIndexWithinParent();
      if (null === s2) o2.__first = i2;
      else {
        s2.getWritable().__next = i2;
      }
      o2.__size++, n2.__prev = i2, r2.__prev = l2, r2.__next = n2.__key, r2.__parent = n2.__parent;
      const a2 = Oi();
      if (e2 && yi(a2)) {
        Ai(a2, this.getParentOrThrow(), c2);
      }
      return t2;
    }
    isParentRequired() {
      return false;
    }
    createParentElementNode() {
      return Ns();
    }
    selectStart() {
      return this.selectPrevious();
    }
    selectEnd() {
      return this.selectNext(0, 0);
    }
    selectPrevious(t2, e2) {
      Yi();
      const n2 = this.getPreviousSibling(), r2 = this.getParentOrThrow();
      if (null === n2) return r2.select(0, 0);
      if (_s(n2)) return n2.select();
      if (!oi(n2)) {
        const t3 = n2.getIndexWithinParent() + 1;
        return r2.select(t3, t3);
      }
      return n2.select(t2, e2);
    }
    selectNext(t2, e2) {
      Yi();
      const n2 = this.getNextSibling(), r2 = this.getParentOrThrow();
      if (null === n2) return r2.select();
      if (_s(n2)) return n2.select(0, 0);
      if (!oi(n2)) {
        const t3 = n2.getIndexWithinParent();
        return r2.select(t3, t3);
      }
      return n2.select(t2, e2);
    }
    markDirty() {
      this.getWritable();
    }
  }
  class Br extends zr {
    static getType() {
      return "linebreak";
    }
    static clone(t2) {
      return new Br(t2.__key);
    }
    constructor(t2) {
      super(t2);
    }
    getTextContent() {
      return "\n";
    }
    createDOM() {
      return document.createElement("br");
    }
    updateDOM() {
      return false;
    }
    static importDOM() {
      return { br: (t2) => (function(t3) {
        const e2 = t3.parentElement;
        if (null !== e2 && Tn(e2)) {
          const n2 = e2.firstChild;
          if (n2 === t3 || n2.nextSibling === t3 && Jr(n2)) {
            const n3 = e2.lastChild;
            if (n3 === t3 || n3.previousSibling === t3 && Jr(n3)) return true;
          }
        }
        return false;
      })(t2) || (function(t3) {
        const e2 = t3.parentElement;
        if (null !== e2 && Tn(e2)) {
          const n2 = e2.firstChild;
          if (n2 === t3 || n2.nextSibling === t3 && Jr(n2)) return false;
          const r2 = e2.lastChild;
          if (r2 === t3 || r2.previousSibling === t3 && Jr(r2)) return true;
        }
        return false;
      })(t2) ? null : { conversion: Rr, priority: 0 } };
    }
    static importJSON(t2) {
      return Kr();
    }
    exportJSON() {
      return { type: "linebreak", version: 1 };
    }
  }
  function Rr(t2) {
    return { node: Kr() };
  }
  function Kr() {
    return fn(new Br());
  }
  function $r(t2) {
    return t2 instanceof Br;
  }
  function Jr(t2) {
    return t2.nodeType === it && /^( |\t|\r?\n)+$/.test(t2.textContent || "");
  }
  function Ur(t2, e2) {
    return 16 & e2 ? "code" : e2 & mt$1 ? "mark" : 32 & e2 ? "sub" : 64 & e2 ? "sup" : null;
  }
  function Vr(t2, e2) {
    return 1 & e2 ? "strong" : 2 & e2 ? "em" : "span";
  }
  function jr(t2, e2, n2, r2, i2) {
    const s2 = r2.classList;
    let o2 = je(i2, "base");
    void 0 !== o2 && s2.add(...o2), o2 = je(i2, "underlineStrikethrough");
    let l2 = false;
    const c2 = e2 & gt$1 && e2 & ht$1;
    void 0 !== o2 && (n2 & gt$1 && n2 & ht$1 ? (l2 = true, c2 || s2.add(...o2)) : c2 && s2.remove(...o2));
    for (const t3 in Ot$1) {
      const r3 = Ot$1[t3];
      if (o2 = je(i2, t3), void 0 !== o2) if (n2 & r3) {
        if (l2 && ("underline" === t3 || "strikethrough" === t3)) {
          e2 & r3 && s2.remove(...o2);
          continue;
        }
        e2 & r3 && (!c2 || "underline" !== t3) && "strikethrough" !== t3 || s2.add(...o2);
      } else e2 & r3 && s2.remove(...o2);
    }
  }
  function Hr(t2, e2, n2) {
    const r2 = e2.firstChild, i2 = n2.isComposing(), s2 = t2 + (i2 ? wt$1 : "");
    if (null == r2) e2.textContent = s2;
    else {
      const t3 = r2.nodeValue;
      if (t3 !== s2) if (i2 || Q$1) {
        const [e3, n3, i3] = (function(t4, e4) {
          const n4 = t4.length, r3 = e4.length;
          let i4 = 0, s3 = 0;
          for (; i4 < n4 && i4 < r3 && t4[i4] === e4[i4]; ) i4++;
          for (; s3 + i4 < n4 && s3 + i4 < r3 && t4[n4 - s3 - 1] === e4[r3 - s3 - 1]; ) s3++;
          return [i4, n4 - i4 - s3, e4.slice(i4, r3 - s3)];
        })(t3, s2);
        0 !== n3 && r2.deleteData(e3, n3), r2.insertData(e3, i3);
      } else r2.nodeValue = s2;
    }
  }
  function qr(t2, e2, n2, r2, i2, s2) {
    Hr(i2, t2, e2);
    const o2 = s2.theme.text;
    void 0 !== o2 && jr(0, 0, r2, t2, o2);
  }
  function Qr(t2, e2) {
    const n2 = document.createElement(e2);
    return n2.appendChild(t2), n2;
  }
  class Xr extends zr {
    static getType() {
      return "text";
    }
    static clone(t2) {
      return new Xr(t2.__text, t2.__key);
    }
    afterCloneFrom(t2) {
      super.afterCloneFrom(t2), this.__format = t2.__format, this.__style = t2.__style, this.__mode = t2.__mode, this.__detail = t2.__detail;
    }
    constructor(t2, e2) {
      super(e2), this.__text = t2, this.__format = 0, this.__style = "", this.__mode = 0, this.__detail = 0;
    }
    getFormat() {
      return this.getLatest().__format;
    }
    getDetail() {
      return this.getLatest().__detail;
    }
    getMode() {
      const t2 = this.getLatest();
      return zt[t2.__mode];
    }
    getStyle() {
      return this.getLatest().__style;
    }
    isToken() {
      return 1 === this.getLatest().__mode;
    }
    isComposing() {
      return this.__key === ve();
    }
    isSegmented() {
      return 2 === this.getLatest().__mode;
    }
    isDirectionless() {
      return !!(1 & this.getLatest().__detail);
    }
    isUnmergeable() {
      return !!(2 & this.getLatest().__detail);
    }
    hasFormat(t2) {
      const e2 = Ot$1[t2];
      return !!(this.getFormat() & e2);
    }
    isSimpleText() {
      return "text" === this.__type && 0 === this.__mode;
    }
    getTextContent() {
      return this.getLatest().__text;
    }
    getFormatFlags(t2, e2) {
      return ge(this.getLatest().__format, t2, e2);
    }
    canHaveFormat() {
      return true;
    }
    createDOM(t2, e2) {
      const n2 = this.__format, r2 = Ur(0, n2), i2 = Vr(0, n2), s2 = null === r2 ? i2 : r2, o2 = document.createElement(s2);
      let l2 = o2;
      this.hasFormat("code") && o2.setAttribute("spellcheck", "false"), null !== r2 && (l2 = document.createElement(i2), o2.appendChild(l2));
      qr(l2, this, 0, n2, this.__text, t2);
      const c2 = this.__style;
      return "" !== c2 && (o2.style.cssText = c2), o2;
    }
    updateDOM(t2, e2, n2) {
      const r2 = this.__text, i2 = t2.__format, s2 = this.__format, o2 = Ur(0, i2), l2 = Ur(0, s2), c2 = Vr(0, i2), a2 = Vr(0, s2);
      if ((null === o2 ? c2 : o2) !== (null === l2 ? a2 : l2)) return true;
      if (o2 === l2 && c2 !== a2) {
        const t3 = e2.firstChild;
        null == t3 && Rt(48);
        const i3 = document.createElement(a2);
        return qr(i3, this, 0, s2, r2, n2), e2.replaceChild(i3, t3), false;
      }
      let u2 = e2;
      null !== l2 && null !== o2 && (u2 = e2.firstChild, null == u2 && Rt(49)), Hr(r2, u2, this);
      const f2 = n2.theme.text;
      void 0 !== f2 && i2 !== s2 && jr(0, i2, s2, u2, f2);
      const d2 = t2.__style, h2 = this.__style;
      return d2 !== h2 && (e2.style.cssText = h2), false;
    }
    static importDOM() {
      return { "#text": () => ({ conversion: ei, priority: 0 }), b: () => ({ conversion: Zr, priority: 0 }), code: () => ({ conversion: ii, priority: 0 }), em: () => ({ conversion: ii, priority: 0 }), i: () => ({ conversion: ii, priority: 0 }), s: () => ({ conversion: ii, priority: 0 }), span: () => ({ conversion: Yr, priority: 0 }), strong: () => ({ conversion: ii, priority: 0 }), sub: () => ({ conversion: ii, priority: 0 }), sup: () => ({ conversion: ii, priority: 0 }), u: () => ({ conversion: ii, priority: 0 }) };
    }
    static importJSON(t2) {
      const e2 = si(t2.text);
      return e2.setFormat(t2.format), e2.setDetail(t2.detail), e2.setMode(t2.mode), e2.setStyle(t2.style), e2;
    }
    exportDOM(t2) {
      let { element: e2 } = super.exportDOM(t2);
      return null !== e2 && vn(e2) || Rt(132), e2.style.whiteSpace = "pre-wrap", this.hasFormat("bold") && (e2 = Qr(e2, "b")), this.hasFormat("italic") && (e2 = Qr(e2, "i")), this.hasFormat("strikethrough") && (e2 = Qr(e2, "s")), this.hasFormat("underline") && (e2 = Qr(e2, "u")), { element: e2 };
    }
    exportJSON() {
      return { detail: this.getDetail(), format: this.getFormat(), mode: this.getMode(), style: this.getStyle(), text: this.getTextContent(), type: "text", version: 1 };
    }
    selectionTransform(t2, e2) {
    }
    setFormat(t2) {
      const e2 = this.getWritable();
      return e2.__format = "string" == typeof t2 ? Ot$1[t2] : t2, e2;
    }
    setDetail(t2) {
      const e2 = this.getWritable();
      return e2.__detail = "string" == typeof t2 ? It$1[t2] : t2, e2;
    }
    setStyle(t2) {
      const e2 = this.getWritable();
      return e2.__style = t2, e2;
    }
    toggleFormat(t2) {
      const e2 = ge(this.getFormat(), t2, null);
      return this.setFormat(e2);
    }
    toggleDirectionless() {
      const t2 = this.getWritable();
      return t2.__detail ^= 1, t2;
    }
    toggleUnmergeable() {
      const t2 = this.getWritable();
      return t2.__detail ^= 2, t2;
    }
    setMode(t2) {
      const e2 = Wt[t2];
      if (this.__mode === e2) return this;
      const n2 = this.getWritable();
      return n2.__mode = e2, n2;
    }
    setTextContent(t2) {
      if (this.__text === t2) return this;
      const e2 = this.getWritable();
      return e2.__text = t2, e2;
    }
    select(t2, e2) {
      Yi();
      let n2 = t2, r2 = e2;
      const i2 = Oi(), s2 = this.getTextContent(), o2 = this.__key;
      if ("string" == typeof s2) {
        const t3 = s2.length;
        void 0 === n2 && (n2 = t3), void 0 === r2 && (r2 = t3);
      } else n2 = 0, r2 = 0;
      if (!yi(i2)) return Ei(o2, n2, o2, r2, "text", "text");
      {
        const t3 = ve();
        t3 !== i2.anchor.key && t3 !== i2.focus.key || xe(o2), i2.setTextNodeRange(this, n2, this, r2);
      }
      return i2;
    }
    selectStart() {
      return this.select(0, 0);
    }
    selectEnd() {
      const t2 = this.getTextContentSize();
      return this.select(t2, t2);
    }
    spliceText(t2, e2, n2, r2) {
      const i2 = this.getWritable(), s2 = i2.__text, o2 = n2.length;
      let l2 = t2;
      l2 < 0 && (l2 = o2 + l2, l2 < 0 && (l2 = 0));
      const c2 = Oi();
      if (r2 && yi(c2)) {
        const e3 = t2 + o2;
        c2.setTextNodeRange(i2, e3, i2, e3);
      }
      const a2 = s2.slice(0, l2) + n2 + s2.slice(l2 + e2);
      return i2.__text = a2, i2;
    }
    canInsertTextBefore() {
      return true;
    }
    canInsertTextAfter() {
      return true;
    }
    splitText(...t2) {
      Yi();
      const e2 = this.getLatest(), n2 = e2.getTextContent(), r2 = e2.__key, i2 = ve(), s2 = new Set(t2), o2 = [], l2 = n2.length;
      let c2 = "";
      for (let t3 = 0; t3 < l2; t3++) "" !== c2 && s2.has(t3) && (o2.push(c2), c2 = ""), c2 += n2[t3];
      "" !== c2 && o2.push(c2);
      const a2 = o2.length;
      if (0 === a2) return [];
      if (o2[0] === n2) return [e2];
      const u2 = o2[0], f2 = e2.getParent();
      let d2;
      const h2 = e2.getFormat(), g2 = e2.getStyle(), _2 = e2.__detail;
      let p2 = false;
      e2.isSegmented() ? (d2 = si(u2), d2.__format = h2, d2.__style = g2, d2.__detail = _2, p2 = true) : (d2 = e2.getWritable(), d2.__text = u2);
      const y2 = Oi(), m2 = [d2];
      let x2 = u2.length;
      for (let t3 = 1; t3 < a2; t3++) {
        const e3 = o2[t3], n3 = e3.length, s3 = si(e3).getWritable();
        s3.__format = h2, s3.__style = g2, s3.__detail = _2;
        const l3 = s3.__key, c3 = x2 + n3;
        if (yi(y2)) {
          const t4 = y2.anchor, e4 = y2.focus;
          t4.key === r2 && "text" === t4.type && t4.offset > x2 && t4.offset <= c3 && (t4.key = l3, t4.offset -= x2, y2.dirty = true), e4.key === r2 && "text" === e4.type && e4.offset > x2 && e4.offset <= c3 && (e4.key = l3, e4.offset -= x2, y2.dirty = true);
        }
        i2 === r2 && xe(l3), x2 = c3, m2.push(s3);
      }
      if (null !== f2) {
        !(function(t4) {
          const e4 = t4.getPreviousSibling(), n3 = t4.getNextSibling();
          null !== e4 && me(e4), null !== n3 && me(n3);
        })(this);
        const t3 = f2.getWritable(), e3 = this.getIndexWithinParent();
        p2 ? (t3.splice(e3, 0, m2), this.remove()) : t3.splice(e3, 1, m2), yi(y2) && Ai(y2, f2, e3, a2 - 1);
      }
      return m2;
    }
    mergeWithSibling(t2) {
      const e2 = t2 === this.getPreviousSibling();
      e2 || t2 === this.getNextSibling() || Rt(50);
      const n2 = this.__key, r2 = t2.__key, i2 = this.__text, s2 = i2.length;
      ve() === r2 && xe(n2);
      const o2 = Oi();
      if (yi(o2)) {
        const i3 = o2.anchor, l3 = o2.focus;
        null !== i3 && i3.key === r2 && (zi(i3, e2, n2, t2, s2), o2.dirty = true), null !== l3 && l3.key === r2 && (zi(l3, e2, n2, t2, s2), o2.dirty = true);
      }
      const l2 = t2.__text, c2 = e2 ? l2 + i2 : i2 + l2;
      this.setTextContent(c2);
      const a2 = this.getWritable();
      return t2.remove(), a2;
    }
    isTextEntity() {
      return false;
    }
  }
  function Yr(t2) {
    return { forChild: li(t2.style), node: null };
  }
  function Zr(t2) {
    const e2 = t2, n2 = "normal" === e2.style.fontWeight;
    return { forChild: li(e2.style, n2 ? void 0 : "bold"), node: null };
  }
  const Gr = /* @__PURE__ */ new WeakMap();
  function ti(t2) {
    return "PRE" === t2.nodeName || t2.nodeType === rt && void 0 !== t2.style && void 0 !== t2.style.whiteSpace && t2.style.whiteSpace.startsWith("pre");
  }
  function ei(t2) {
    const e2 = t2;
    null === t2.parentElement && Rt(129);
    let n2 = e2.textContent || "";
    if (null !== (function(t3) {
      let e3, n3 = t3.parentNode;
      const r2 = [t3];
      for (; null !== n3 && void 0 === (e3 = Gr.get(n3)) && !ti(n3); ) r2.push(n3), n3 = n3.parentNode;
      const i2 = void 0 === e3 ? n3 : e3;
      for (let t4 = 0; t4 < r2.length; t4++) Gr.set(r2[t4], i2);
      return i2;
    })(e2)) {
      const t3 = n2.split(/(\r?\n|\t)/), e3 = [], r2 = t3.length;
      for (let n3 = 0; n3 < r2; n3++) {
        const r3 = t3[n3];
        "\n" === r3 || "\r\n" === r3 ? e3.push(Kr()) : "	" === r3 ? e3.push(ai()) : "" !== r3 && e3.push(si(r3));
      }
      return { node: e3 };
    }
    if (n2 = n2.replace(/\r/g, "").replace(/[ \t\n]+/g, " "), "" === n2) return { node: null };
    if (" " === n2[0]) {
      let t3 = e2, r2 = true;
      for (; null !== t3 && null !== (t3 = ni(t3, false)); ) {
        const e3 = t3.textContent || "";
        if (e3.length > 0) {
          /[ \t\n]$/.test(e3) && (n2 = n2.slice(1)), r2 = false;
          break;
        }
      }
      r2 && (n2 = n2.slice(1));
    }
    if (" " === n2[n2.length - 1]) {
      let t3 = e2, r2 = true;
      for (; null !== t3 && null !== (t3 = ni(t3, true)); ) {
        if ((t3.textContent || "").replace(/^( |\t|\r?\n)+/, "").length > 0) {
          r2 = false;
          break;
        }
      }
      r2 && (n2 = n2.slice(0, n2.length - 1));
    }
    return "" === n2 ? { node: null } : { node: si(n2) };
  }
  function ni(t2, e2) {
    let n2 = t2;
    for (; ; ) {
      let t3;
      for (; null === (t3 = e2 ? n2.nextSibling : n2.previousSibling); ) {
        const t4 = n2.parentElement;
        if (null === t4) return null;
        n2 = t4;
      }
      if (n2 = t3, n2.nodeType === rt) {
        const t4 = n2.style.display;
        if ("" === t4 && !Sn(n2) || "" !== t4 && !t4.startsWith("inline")) return null;
      }
      let r2 = n2;
      for (; null !== (r2 = e2 ? n2.firstChild : n2.lastChild); ) n2 = r2;
      if (n2.nodeType === it) return n2;
      if ("BR" === n2.nodeName) return null;
    }
  }
  const ri = { code: "code", em: "italic", i: "italic", s: "strikethrough", strong: "bold", sub: "subscript", sup: "superscript", u: "underline" };
  function ii(t2) {
    const e2 = ri[t2.nodeName.toLowerCase()];
    return void 0 === e2 ? { node: null } : { forChild: li(t2.style, e2), node: null };
  }
  function si(t2 = "") {
    return fn(new Xr(t2));
  }
  function oi(t2) {
    return t2 instanceof Xr;
  }
  function li(t2, e2) {
    const n2 = t2.fontWeight, r2 = t2.textDecoration.split(" "), i2 = "700" === n2 || "bold" === n2, s2 = r2.includes("line-through"), o2 = "italic" === t2.fontStyle, l2 = r2.includes("underline"), c2 = t2.verticalAlign;
    return (t3) => oi(t3) ? (i2 && !t3.hasFormat("bold") && t3.toggleFormat("bold"), s2 && !t3.hasFormat("strikethrough") && t3.toggleFormat("strikethrough"), o2 && !t3.hasFormat("italic") && t3.toggleFormat("italic"), l2 && !t3.hasFormat("underline") && t3.toggleFormat("underline"), "sub" !== c2 || t3.hasFormat("subscript") || t3.toggleFormat("subscript"), "super" !== c2 || t3.hasFormat("superscript") || t3.toggleFormat("superscript"), e2 && !t3.hasFormat(e2) && t3.toggleFormat(e2), t3) : t3;
  }
  class ci extends Xr {
    static getType() {
      return "tab";
    }
    static clone(t2) {
      return new ci(t2.__key);
    }
    afterCloneFrom(t2) {
      super.afterCloneFrom(t2), this.__text = t2.__text;
    }
    constructor(t2) {
      super("	", t2), this.__detail = 2;
    }
    static importDOM() {
      return null;
    }
    static importJSON(t2) {
      const e2 = ai();
      return e2.setFormat(t2.format), e2.setStyle(t2.style), e2;
    }
    exportJSON() {
      return __spreadProps(__spreadValues({}, super.exportJSON()), { type: "tab", version: 1 });
    }
    setTextContent(t2) {
      Rt(126);
    }
    setDetail(t2) {
      Rt(127);
    }
    setMode(t2) {
      Rt(128);
    }
    canInsertTextBefore() {
      return false;
    }
    canInsertTextAfter() {
      return false;
    }
  }
  function ai() {
    return fn(new ci());
  }
  function ui(t2) {
    return t2 instanceof ci;
  }
  class fi {
    constructor(t2, e2, n2) {
      this._selection = null, this.key = t2, this.offset = e2, this.type = n2;
    }
    is(t2) {
      return this.key === t2.key && this.offset === t2.offset && this.type === t2.type;
    }
    isBefore(t2) {
      let e2 = this.getNode(), n2 = t2.getNode();
      const r2 = this.offset, i2 = t2.offset;
      if (_s(e2)) {
        const t3 = e2.getDescendantByIndex(r2);
        e2 = null != t3 ? t3 : e2;
      }
      if (_s(n2)) {
        const t3 = n2.getDescendantByIndex(i2);
        n2 = null != t3 ? t3 : n2;
      }
      return e2 === n2 ? r2 < i2 : e2.isBefore(n2);
    }
    getNode() {
      const t2 = Se(this.key);
      return null === t2 && Rt(20), t2;
    }
    set(t2, e2, n2) {
      const r2 = this._selection, i2 = this.key;
      this.key = t2, this.offset = e2, this.type = n2, Xi() || (ve() === i2 && xe(t2), null !== r2 && (r2.setCachedNodes(null), r2.dirty = true));
    }
  }
  function di(t2, e2, n2) {
    return new fi(t2, e2, n2);
  }
  function hi(t2, e2) {
    let n2 = e2.__key, r2 = t2.offset, i2 = "element";
    if (oi(e2)) {
      i2 = "text";
      const t3 = e2.getTextContentSize();
      r2 > t3 && (r2 = t3);
    } else if (!_s(e2)) {
      const t3 = e2.getNextSibling();
      if (oi(t3)) n2 = t3.__key, r2 = 0, i2 = "text";
      else {
        const t4 = e2.getParent();
        t4 && (n2 = t4.__key, r2 = e2.getIndexWithinParent() + 1);
      }
    }
    t2.set(n2, r2, i2);
  }
  function gi(t2, e2) {
    if (_s(e2)) {
      const n2 = e2.getLastDescendant();
      _s(n2) || oi(n2) ? hi(t2, n2) : hi(t2, e2);
    } else hi(t2, e2);
  }
  function _i(t2, e2, n2, r2) {
    t2.key = e2, t2.offset = n2, t2.type = r2;
  }
  class pi {
    constructor(t2) {
      this._cachedNodes = null, this._nodes = t2, this.dirty = false;
    }
    getCachedNodes() {
      return this._cachedNodes;
    }
    setCachedNodes(t2) {
      this._cachedNodes = t2;
    }
    is(t2) {
      if (!xi(t2)) return false;
      const e2 = this._nodes, n2 = t2._nodes;
      return e2.size === n2.size && Array.from(e2).every(((t3) => n2.has(t3)));
    }
    isCollapsed() {
      return false;
    }
    isBackward() {
      return false;
    }
    getStartEndPoints() {
      return null;
    }
    add(t2) {
      this.dirty = true, this._nodes.add(t2), this._cachedNodes = null;
    }
    delete(t2) {
      this.dirty = true, this._nodes.delete(t2), this._cachedNodes = null;
    }
    clear() {
      this.dirty = true, this._nodes.clear(), this._cachedNodes = null;
    }
    has(t2) {
      return this._nodes.has(t2);
    }
    clone() {
      return new pi(new Set(this._nodes));
    }
    extract() {
      return this.getNodes();
    }
    insertRawText(t2) {
    }
    insertText() {
    }
    insertNodes(t2) {
      const e2 = this.getNodes(), n2 = e2.length, r2 = e2[n2 - 1];
      let i2;
      if (oi(r2)) i2 = r2.select();
      else {
        const t3 = r2.getIndexWithinParent() + 1;
        i2 = r2.getParentOrThrow().select(t3, t3);
      }
      i2.insertNodes(t2);
      for (let t3 = 0; t3 < n2; t3++) e2[t3].remove();
    }
    getNodes() {
      const t2 = this._cachedNodes;
      if (null !== t2) return t2;
      const e2 = this._nodes, n2 = [];
      for (const t3 of e2) {
        const e3 = Se(t3);
        null !== e3 && n2.push(e3);
      }
      return Xi() || (this._cachedNodes = n2), n2;
    }
    getTextContent() {
      const t2 = this.getNodes();
      let e2 = "";
      for (let n2 = 0; n2 < t2.length; n2++) e2 += t2[n2].getTextContent();
      return e2;
    }
  }
  function yi(t2) {
    return t2 instanceof mi;
  }
  class mi {
    constructor(t2, e2, n2, r2) {
      this.anchor = t2, this.focus = e2, t2._selection = this, e2._selection = this, this._cachedNodes = null, this.format = n2, this.style = r2, this.dirty = false;
    }
    getCachedNodes() {
      return this._cachedNodes;
    }
    setCachedNodes(t2) {
      this._cachedNodes = t2;
    }
    is(t2) {
      return !!yi(t2) && (this.anchor.is(t2.anchor) && this.focus.is(t2.focus) && this.format === t2.format && this.style === t2.style);
    }
    isCollapsed() {
      return this.anchor.is(this.focus);
    }
    getNodes() {
      const t2 = this._cachedNodes;
      if (null !== t2) return t2;
      const e2 = this.anchor, n2 = this.focus, r2 = e2.isBefore(n2), i2 = r2 ? e2 : n2, s2 = r2 ? n2 : e2;
      let o2 = i2.getNode(), l2 = s2.getNode();
      const c2 = i2.offset, a2 = s2.offset;
      if (_s(o2)) {
        const t3 = o2.getDescendantByIndex(c2);
        o2 = null != t3 ? t3 : o2;
      }
      if (_s(l2)) {
        let t3 = l2.getDescendantByIndex(a2);
        null !== t3 && t3 !== o2 && l2.getChildAtIndex(a2) === t3 && (t3 = t3.getPreviousSibling()), l2 = null != t3 ? t3 : l2;
      }
      let u2;
      return u2 = o2.is(l2) ? _s(o2) && o2.getChildrenSize() > 0 ? [] : [o2] : o2.getNodesBetween(l2), Xi() || (this._cachedNodes = u2), u2;
    }
    setTextNodeRange(t2, e2, n2, r2) {
      _i(this.anchor, t2.__key, e2, "text"), _i(this.focus, n2.__key, r2, "text"), this._cachedNodes = null, this.dirty = true;
    }
    getTextContent() {
      const t2 = this.getNodes();
      if (0 === t2.length) return "";
      const e2 = t2[0], n2 = t2[t2.length - 1], r2 = this.anchor, i2 = this.focus, s2 = r2.isBefore(i2), [o2, l2] = Si(this);
      let c2 = "", a2 = true;
      for (let u2 = 0; u2 < t2.length; u2++) {
        const f2 = t2[u2];
        if (_s(f2) && !f2.isInline()) a2 || (c2 += "\n"), a2 = !f2.isEmpty();
        else if (a2 = false, oi(f2)) {
          let t3 = f2.getTextContent();
          f2 === e2 ? f2 === n2 ? "element" === r2.type && "element" === i2.type && i2.offset !== r2.offset || (t3 = o2 < l2 ? t3.slice(o2, l2) : t3.slice(l2, o2)) : t3 = s2 ? t3.slice(o2) : t3.slice(l2) : f2 === n2 && (t3 = s2 ? t3.slice(0, l2) : t3.slice(0, o2)), c2 += t3;
        } else !ms(f2) && !$r(f2) || f2 === n2 && this.isCollapsed() || (c2 += f2.getTextContent());
      }
      return c2;
    }
    applyDOMRange(t2) {
      const e2 = ts(), n2 = e2.getEditorState()._selection, r2 = wi(t2.startContainer, t2.startOffset, t2.endContainer, t2.endOffset, e2, n2);
      if (null === r2) return;
      const [i2, s2] = r2;
      _i(this.anchor, i2.key, i2.offset, i2.type), _i(this.focus, s2.key, s2.offset, s2.type), this._cachedNodes = null;
    }
    clone() {
      const t2 = this.anchor, e2 = this.focus;
      return new mi(di(t2.key, t2.offset, t2.type), di(e2.key, e2.offset, e2.type), this.format, this.style);
    }
    toggleFormat(t2) {
      this.format = ge(this.format, t2, null), this.dirty = true;
    }
    setStyle(t2) {
      this.style = t2, this.dirty = true;
    }
    hasFormat(t2) {
      const e2 = Ot$1[t2];
      return !!(this.format & e2);
    }
    insertRawText(t2) {
      const e2 = t2.split(/(\r?\n|\t)/), n2 = [], r2 = e2.length;
      for (let t3 = 0; t3 < r2; t3++) {
        const r3 = e2[t3];
        "\n" === r3 || "\r\n" === r3 ? n2.push(Kr()) : "	" === r3 ? n2.push(ai()) : n2.push(si(r3));
      }
      this.insertNodes(n2);
    }
    insertText(t2) {
      const e2 = this.anchor, n2 = this.focus, r2 = this.format, i2 = this.style;
      let s2 = e2, o2 = n2;
      !this.isCollapsed() && n2.isBefore(e2) && (s2 = n2, o2 = e2), "element" === s2.type && (function(t3, e3, n3, r3) {
        const i3 = t3.getNode(), s3 = i3.getChildAtIndex(t3.offset), o3 = si(), l3 = vs(i3) ? Ns().append(o3) : o3;
        o3.setFormat(n3), o3.setStyle(r3), null === s3 ? i3.append(l3) : s3.insertBefore(l3), t3.is(e3) && e3.set(o3.__key, 0, "text"), t3.set(o3.__key, 0, "text");
      })(s2, o2, r2, i2);
      const l2 = s2.offset;
      let c2 = o2.offset;
      const a2 = this.getNodes(), u2 = a2.length;
      let f2 = a2[0];
      oi(f2) || Rt(26);
      const d2 = f2.getTextContent().length, h2 = f2.getParentOrThrow();
      let g2 = a2[u2 - 1];
      if (1 === u2 && "element" === o2.type && (c2 = d2, o2.set(s2.key, c2, "text")), this.isCollapsed() && l2 === d2 && (f2.isSegmented() || f2.isToken() || !f2.canInsertTextAfter() || !h2.canInsertTextAfter() && null === f2.getNextSibling())) {
        let e3 = f2.getNextSibling();
        if (oi(e3) && e3.canInsertTextBefore() && !fe(e3) || (e3 = si(), e3.setFormat(r2), e3.setStyle(i2), h2.canInsertTextAfter() ? f2.insertAfter(e3) : h2.insertAfter(e3)), e3.select(0, 0), f2 = e3, "" !== t2) return void this.insertText(t2);
      } else if (this.isCollapsed() && 0 === l2 && (f2.isSegmented() || f2.isToken() || !f2.canInsertTextBefore() || !h2.canInsertTextBefore() && null === f2.getPreviousSibling())) {
        let e3 = f2.getPreviousSibling();
        if (oi(e3) && !fe(e3) || (e3 = si(), e3.setFormat(r2), h2.canInsertTextBefore() ? f2.insertBefore(e3) : h2.insertBefore(e3)), e3.select(), f2 = e3, "" !== t2) return void this.insertText(t2);
      } else if (f2.isSegmented() && l2 !== d2) {
        const t3 = si(f2.getTextContent());
        t3.setFormat(r2), f2.replace(t3), f2 = t3;
      } else if (!this.isCollapsed() && "" !== t2) {
        const e3 = g2.getParent();
        if (!h2.canInsertTextBefore() || !h2.canInsertTextAfter() || _s(e3) && (!e3.canInsertTextBefore() || !e3.canInsertTextAfter())) return this.insertText(""), bi(this.anchor, this.focus, null), void this.insertText(t2);
      }
      if (1 === u2) {
        if (f2.isToken()) {
          const e4 = si(t2);
          return e4.select(), void f2.replace(e4);
        }
        const e3 = f2.getFormat(), n3 = f2.getStyle();
        if (l2 !== c2 || e3 === r2 && n3 === i2) {
          if (ui(f2)) {
            const e4 = si(t2);
            return e4.setFormat(r2), e4.setStyle(i2), e4.select(), void f2.replace(e4);
          }
        } else {
          if ("" !== f2.getTextContent()) {
            const e4 = si(t2);
            if (e4.setFormat(r2), e4.setStyle(i2), e4.select(), 0 === l2) f2.insertBefore(e4, false);
            else {
              const [t3] = f2.splitText(l2);
              t3.insertAfter(e4, false);
            }
            return void (e4.isComposing() && "text" === this.anchor.type && (this.anchor.offset -= t2.length));
          }
          f2.setFormat(r2), f2.setStyle(i2);
        }
        const s3 = c2 - l2;
        f2 = f2.spliceText(l2, s3, t2, true), "" === f2.getTextContent() ? f2.remove() : "text" === this.anchor.type && (f2.isComposing() ? this.anchor.offset -= t2.length : (this.format = e3, this.style = n3));
      } else {
        const e3 = /* @__PURE__ */ new Set([...f2.getParentKeys(), ...g2.getParentKeys()]), n3 = _s(f2) ? f2 : f2.getParentOrThrow();
        let r3 = _s(g2) ? g2 : g2.getParentOrThrow(), i3 = g2;
        if (!n3.is(r3) && r3.isInline()) do {
          i3 = r3, r3 = r3.getParentOrThrow();
        } while (r3.isInline());
        if ("text" === o2.type && (0 !== c2 || "" === g2.getTextContent()) || "element" === o2.type && g2.getIndexWithinParent() < c2) if (oi(g2) && !g2.isToken() && c2 !== g2.getTextContentSize()) {
          if (g2.isSegmented()) {
            const t3 = si(g2.getTextContent());
            g2.replace(t3), g2 = t3;
          }
          vs(o2.getNode()) || "text" !== o2.type || (g2 = g2.spliceText(0, c2, "")), e3.add(g2.__key);
        } else {
          const t3 = g2.getParentOrThrow();
          t3.canBeEmpty() || 1 !== t3.getChildrenSize() ? g2.remove() : t3.remove();
        }
        else e3.add(g2.__key);
        const s3 = r3.getChildren(), h3 = new Set(a2), _2 = n3.is(r3), p2 = n3.isInline() && null === f2.getNextSibling() ? n3 : f2;
        for (let t3 = s3.length - 1; t3 >= 0; t3--) {
          const e4 = s3[t3];
          if (e4.is(f2) || _s(e4) && e4.isParentOf(f2)) break;
          e4.isAttached() && (!h3.has(e4) || e4.is(i3) ? _2 || p2.insertAfter(e4, false) : e4.remove());
        }
        if (!_2) {
          let t3 = r3, n4 = null;
          for (; null !== t3; ) {
            const r4 = t3.getChildren(), i4 = r4.length;
            (0 === i4 || r4[i4 - 1].is(n4)) && (e3.delete(t3.__key), n4 = t3), t3 = t3.getParent();
          }
        }
        if (f2.isToken()) if (l2 === d2) f2.select();
        else {
          const e4 = si(t2);
          e4.select(), f2.replace(e4);
        }
        else f2 = f2.spliceText(l2, d2 - l2, t2, true), "" === f2.getTextContent() ? f2.remove() : f2.isComposing() && "text" === this.anchor.type && (this.anchor.offset -= t2.length);
        for (let t3 = 1; t3 < u2; t3++) {
          const n4 = a2[t3], r4 = n4.__key;
          e3.has(r4) || n4.remove();
        }
      }
    }
    removeText() {
      this.insertText("");
    }
    formatText(t2) {
      if (this.isCollapsed()) return this.toggleFormat(t2), void xe(null);
      const e2 = this.getNodes(), n2 = [];
      for (const t3 of e2) oi(t3) && n2.push(t3);
      const r2 = n2.length;
      if (0 === r2) return this.toggleFormat(t2), void xe(null);
      const i2 = this.anchor, s2 = this.focus, o2 = this.isBackward(), l2 = o2 ? s2 : i2, c2 = o2 ? i2 : s2;
      let a2 = 0, u2 = n2[0], f2 = "element" === l2.type ? 0 : l2.offset;
      if ("text" === l2.type && f2 === u2.getTextContentSize() && (a2 = 1, u2 = n2[1], f2 = 0), null == u2) return;
      const d2 = u2.getFormatFlags(t2, null), h2 = r2 - 1;
      let g2 = n2[h2];
      const _2 = "text" === c2.type ? c2.offset : g2.getTextContentSize();
      if (u2.is(g2)) {
        if (f2 === _2) return;
        if (fe(u2) || 0 === f2 && _2 === u2.getTextContentSize()) u2.setFormat(d2);
        else {
          const t3 = u2.splitText(f2, _2), e3 = 0 === f2 ? t3[0] : t3[1];
          e3.setFormat(d2), "text" === l2.type && l2.set(e3.__key, 0, "text"), "text" === c2.type && c2.set(e3.__key, _2 - f2, "text");
        }
        return void (this.format = d2);
      }
      0 === f2 || fe(u2) || ([, u2] = u2.splitText(f2), f2 = 0), u2.setFormat(d2);
      const p2 = g2.getFormatFlags(t2, d2);
      _2 > 0 && (_2 === g2.getTextContentSize() || fe(g2) || ([g2] = g2.splitText(_2)), g2.setFormat(p2));
      for (let e3 = a2 + 1; e3 < h2; e3++) {
        const r3 = n2[e3], i3 = r3.getFormatFlags(t2, p2);
        r3.setFormat(i3);
      }
      "text" === l2.type && l2.set(u2.__key, f2, "text"), "text" === c2.type && c2.set(g2.__key, _2, "text"), this.format = d2 | p2;
    }
    insertNodes(t2) {
      if (0 === t2.length) return;
      if ("root" === this.anchor.key) {
        this.insertParagraph();
        const e3 = Oi();
        return yi(e3) || Rt(134), e3.insertNodes(t2);
      }
      const e2 = kn((this.isBackward() ? this.focus : this.anchor).getNode(), Cn), n2 = t2[t2.length - 1];
      if ("__language" in e2 && _s(e2)) {
        if ("__language" in t2[0]) this.insertText(t2[0].getTextContent());
        else {
          const r3 = $i(this);
          e2.splice(r3, 0, t2), n2.selectEnd();
        }
        return;
      }
      if (!t2.some(((t3) => (_s(t3) || ms(t3)) && !t3.isInline()))) {
        _s(e2) || Rt(135);
        const r3 = $i(this);
        return e2.splice(r3, 0, t2), void n2.selectEnd();
      }
      const r2 = (function(t3) {
        const e3 = Ns();
        let n3 = null;
        for (let r3 = 0; r3 < t3.length; r3++) {
          const i3 = t3[r3], s3 = $r(i3);
          if (s3 || ms(i3) && i3.isInline() || _s(i3) && i3.isInline() || oi(i3) || i3.isParentRequired()) {
            if (null === n3 && (n3 = i3.createParentElementNode(), e3.append(n3), s3)) continue;
            null !== n3 && n3.append(i3);
          } else e3.append(i3), n3 = null;
        }
        return e3;
      })(t2), i2 = r2.getLastDescendant(), s2 = r2.getChildren(), o2 = !_s(e2) || !e2.isEmpty() ? this.insertParagraph() : null, l2 = s2[s2.length - 1];
      let c2 = s2[0];
      var a2;
      _s(a2 = c2) && Cn(a2) && !a2.isEmpty() && _s(e2) && (!e2.isEmpty() || e2.canMergeWhenEmpty()) && (_s(e2) || Rt(135), e2.append(...c2.getChildren()), c2 = s2[1]), c2 && (function(t3, e3, n3) {
        const r3 = e3.getParentOrThrow().getLastChild();
        let i3 = e3;
        const s3 = [e3];
        for (; i3 !== r3; ) i3.getNextSibling() || Rt(140), i3 = i3.getNextSibling(), s3.push(i3);
        let o3 = t3;
        for (const t4 of s3) o3 = o3.insertAfter(t4);
      })(e2, c2);
      const u2 = kn(i2, Cn);
      o2 && _s(u2) && (o2.canMergeWhenEmpty() || Cn(l2)) && (u2.append(...o2.getChildren()), o2.remove()), _s(e2) && e2.isEmpty() && e2.remove(), i2.selectEnd();
      const f2 = _s(e2) ? e2.getLastChild() : null;
      $r(f2) && u2 !== e2 && f2.remove();
    }
    insertParagraph() {
      if ("root" === this.anchor.key) {
        const t3 = Ns();
        return we().splice(this.anchor.offset, 0, [t3]), t3.select(), t3;
      }
      const t2 = $i(this), e2 = kn(this.anchor.getNode(), Cn);
      _s(e2) || Rt(136);
      const n2 = e2.getChildAtIndex(t2), r2 = n2 ? [n2, ...n2.getNextSiblings()] : [], i2 = e2.insertNewAfter(this, false);
      return i2 ? (i2.append(...r2), i2.selectStart(), i2) : null;
    }
    insertLineBreak(t2) {
      const e2 = Kr();
      if (this.insertNodes([e2]), t2) {
        const t3 = e2.getParentOrThrow(), n2 = e2.getIndexWithinParent();
        t3.select(n2, n2);
      }
    }
    extract() {
      const t2 = this.getNodes(), e2 = t2.length, n2 = e2 - 1, r2 = this.anchor, i2 = this.focus;
      let s2 = t2[0], o2 = t2[n2];
      const [l2, c2] = Si(this);
      if (0 === e2) return [];
      if (1 === e2) {
        if (oi(s2) && !this.isCollapsed()) {
          const t3 = l2 > c2 ? c2 : l2, e3 = l2 > c2 ? l2 : c2, n3 = s2.splitText(t3, e3), r3 = 0 === t3 ? n3[0] : n3[1];
          return null != r3 ? [r3] : [];
        }
        return [s2];
      }
      const a2 = r2.isBefore(i2);
      if (oi(s2)) {
        const e3 = a2 ? l2 : c2;
        e3 === s2.getTextContentSize() ? t2.shift() : 0 !== e3 && ([, s2] = s2.splitText(e3), t2[0] = s2);
      }
      if (oi(o2)) {
        const e3 = o2.getTextContent().length, r3 = a2 ? c2 : l2;
        0 === r3 ? t2.pop() : r3 !== e3 && ([o2] = o2.splitText(r3), t2[n2] = o2);
      }
      return t2;
    }
    modify(t2, e2, n2) {
      const r2 = this.focus, i2 = this.anchor, s2 = "move" === t2, o2 = Xe(r2, e2);
      if (ms(o2) && !o2.isIsolated()) {
        if (s2 && o2.isKeyboardSelectable()) {
          const t4 = Fi();
          return t4.add(o2.__key), void Ee(t4);
        }
        const t3 = e2 ? o2.getPreviousSibling() : o2.getNextSibling();
        if (oi(t3)) {
          const n3 = t3.__key, o3 = e2 ? t3.getTextContent().length : 0;
          return r2.set(n3, o3, "text"), void (s2 && i2.set(n3, o3, "text"));
        }
        {
          const n3 = o2.getParentOrThrow();
          let l3, c3;
          return _s(t3) ? (c3 = t3.__key, l3 = e2 ? t3.getChildrenSize() : 0) : (l3 = o2.getIndexWithinParent(), c3 = n3.__key, e2 || l3++), r2.set(c3, l3, "element"), void (s2 && i2.set(c3, l3, "element"));
        }
      }
      const l2 = ts(), c2 = yn(l2._window);
      if (!c2) return;
      const a2 = l2._blockCursorElement, u2 = l2._rootElement;
      if (null === u2 || null === a2 || !_s(o2) || o2.isInline() || o2.canBeEmpty() || _n(a2, l2, u2), (function(t3, e3, n3, r3) {
        t3.modify(e3, n3, r3);
      })(c2, t2, e2 ? "backward" : "forward", n2), c2.rangeCount > 0) {
        const t3 = c2.getRangeAt(0), n3 = this.anchor.getNode(), r3 = vs(n3) ? n3 : cn(n3);
        if (this.applyDOMRange(t3), this.dirty = true, !s2) {
          const n4 = this.getNodes(), i3 = [];
          let s3 = false;
          for (let t4 = 0; t4 < n4.length; t4++) {
            const e3 = n4[t4];
            sn(e3, r3) ? i3.push(e3) : s3 = true;
          }
          if (s3 && i3.length > 0) if (e2) {
            const t4 = i3[0];
            _s(t4) ? t4.selectStart() : t4.getParentOrThrow().selectStart();
          } else {
            const t4 = i3[i3.length - 1];
            _s(t4) ? t4.selectEnd() : t4.getParentOrThrow().selectEnd();
          }
          c2.anchorNode === t3.startContainer && c2.anchorOffset === t3.startOffset || (function(t4) {
            const e3 = t4.focus, n5 = t4.anchor, r4 = n5.key, i4 = n5.offset, s4 = n5.type;
            _i(n5, e3.key, e3.offset, e3.type), _i(e3, r4, i4, s4), t4._cachedNodes = null;
          })(this);
        }
      }
    }
    forwardDeletion(t2, e2, n2) {
      if (!n2 && ("element" === t2.type && _s(e2) && t2.offset === e2.getChildrenSize() || "text" === t2.type && t2.offset === e2.getTextContentSize())) {
        const t3 = e2.getParent(), n3 = e2.getNextSibling() || (null === t3 ? null : t3.getNextSibling());
        if (_s(n3) && n3.isShadowRoot()) return true;
      }
      return false;
    }
    deleteCharacter(t2) {
      const n2 = this.isCollapsed();
      if (this.isCollapsed()) {
        const n3 = this.anchor;
        let r2 = n3.getNode();
        if (this.forwardDeletion(n3, r2, t2)) return;
        const i2 = this.focus, s2 = Xe(i2, t2);
        if (ms(s2) && !s2.isIsolated()) {
          if (s2.isKeyboardSelectable() && _s(r2) && 0 === r2.getChildrenSize()) {
            r2.remove();
            const t3 = Fi();
            t3.add(s2.__key), Ee(t3);
          } else {
            s2.remove();
            ts().dispatchCommand(e, void 0);
          }
          return;
        }
        if (!t2 && _s(s2) && _s(r2) && r2.isEmpty()) return r2.remove(), void s2.selectStart();
        if (this.modify("extend", t2, "character"), this.isCollapsed()) {
          if (t2 && 0 === n3.offset) {
            if (("element" === n3.type ? n3.getNode() : n3.getNode().getParentOrThrow()).collapseAtStart(this)) return;
          }
        } else {
          const e2 = "text" === i2.type ? i2.getNode() : null;
          if (r2 = "text" === n3.type ? n3.getNode() : null, null !== e2 && e2.isSegmented()) {
            const n4 = i2.offset, s3 = e2.getTextContentSize();
            if (e2.is(r2) || t2 && n4 !== s3 || !t2 && 0 !== n4) return void Ti(e2, t2, n4);
          } else if (null !== r2 && r2.isSegmented()) {
            const i3 = n3.offset, s3 = r2.getTextContentSize();
            if (r2.is(e2) || t2 && 0 !== i3 || !t2 && i3 !== s3) return void Ti(r2, t2, i3);
          }
          !(function(t3, e3) {
            const n4 = t3.anchor, r3 = t3.focus, i3 = n4.getNode(), s3 = r3.getNode();
            if (i3 === s3 && "text" === n4.type && "text" === r3.type) {
              const t4 = n4.offset, s4 = r3.offset, o2 = t4 < s4, l2 = o2 ? t4 : s4, c2 = o2 ? s4 : t4, a2 = c2 - 1;
              if (l2 !== a2) {
                De(i3.getTextContent().slice(l2, c2)) || (e3 ? r3.offset = a2 : n4.offset = a2);
              }
            }
          })(this, t2);
        }
      }
      if (this.removeText(), t2 && !n2 && this.isCollapsed() && "element" === this.anchor.type && 0 === this.anchor.offset) {
        const t3 = this.anchor.getNode();
        t3.isEmpty() && vs(t3.getParent()) && 0 === t3.getIndexWithinParent() && t3.collapseAtStart(this);
      }
    }
    deleteLine(t2) {
      if (this.isCollapsed()) {
        const e2 = "element" === this.anchor.type;
        e2 && this.insertText(" "), this.modify("extend", t2, "lineboundary");
        if (0 === (t2 ? this.focus : this.anchor).offset && this.modify("extend", t2, "character"), e2) {
          const e3 = t2 ? this.anchor : this.focus;
          e3.set(e3.key, e3.offset + 1, e3.type);
        }
      }
      this.removeText();
    }
    deleteWord(t2) {
      if (this.isCollapsed()) {
        const e2 = this.anchor, n2 = e2.getNode();
        if (this.forwardDeletion(e2, n2, t2)) return;
        this.modify("extend", t2, "word");
      }
      this.removeText();
    }
    isBackward() {
      return this.focus.isBefore(this.anchor);
    }
    getStartEndPoints() {
      return [this.anchor, this.focus];
    }
  }
  function xi(t2) {
    return t2 instanceof pi;
  }
  function vi(t2) {
    const e2 = t2.offset;
    if ("text" === t2.type) return e2;
    const n2 = t2.getNode();
    return e2 === n2.getChildrenSize() ? n2.getTextContent().length : 0;
  }
  function Si(t2) {
    const e2 = t2.getStartEndPoints();
    if (null === e2) return [0, 0];
    const [n2, r2] = e2;
    return "element" === n2.type && "element" === r2.type && n2.key === r2.key && n2.offset === r2.offset ? [0, 0] : [vi(n2), vi(r2)];
  }
  function Ti(t2, e2, n2) {
    const r2 = t2, i2 = r2.getTextContent().split(/(?=\s)/g), s2 = i2.length;
    let o2 = 0, l2 = 0;
    for (let t3 = 0; t3 < s2; t3++) {
      const r3 = t3 === s2 - 1;
      if (l2 = o2, o2 += i2[t3].length, e2 && o2 === n2 || o2 > n2 || r3) {
        i2.splice(t3, 1), r3 && (l2 = void 0);
        break;
      }
    }
    const c2 = i2.join("").trim();
    "" === c2 ? r2.remove() : (r2.setTextContent(c2), r2.select(l2, l2));
  }
  function Ci(t2, e2, n2, r2) {
    let i2, s2 = e2;
    if (t2.nodeType === rt) {
      let o2 = false;
      const l2 = t2.childNodes, c2 = l2.length, a2 = r2._blockCursorElement;
      s2 === c2 && (o2 = true, s2 = c2 - 1);
      let u2 = l2[s2], f2 = false;
      if (u2 === a2) u2 = l2[s2 + 1], f2 = true;
      else if (null !== a2) {
        const n3 = a2.parentNode;
        if (t2 === n3) {
          e2 > Array.prototype.indexOf.call(n3.children, a2) && s2--;
        }
      }
      if (i2 = Pe(u2), oi(i2)) s2 = Fe(i2, o2);
      else {
        let r3 = Pe(t2);
        if (null === r3) return null;
        if (_s(r3)) {
          s2 = Math.min(r3.getChildrenSize(), s2);
          let t3 = r3.getChildAtIndex(s2);
          if (_s(t3) && (function(t4, e3, n3) {
            const r4 = t4.getParent();
            return null === n3 || null === r4 || !r4.canBeEmpty() || r4 !== n3.getNode();
          })(t3, 0, n2)) {
            const e3 = o2 ? t3.getLastDescendant() : t3.getFirstDescendant();
            null === e3 ? r3 = t3 : (t3 = e3, r3 = _s(t3) ? t3 : t3.getParentOrThrow()), s2 = 0;
          }
          oi(t3) ? (i2 = t3, r3 = null, s2 = Fe(t3, o2)) : t3 !== r3 && o2 && !f2 && s2++;
        } else {
          const n3 = r3.getIndexWithinParent();
          s2 = 0 === e2 && ms(r3) && Pe(t2) === r3 ? n3 : n3 + 1, r3 = r3.getParentOrThrow();
        }
        if (_s(r3)) return di(r3.__key, s2, "element");
      }
    } else i2 = Pe(t2);
    return oi(i2) ? di(i2.__key, s2, "text") : null;
  }
  function ki(t2, e2, n2) {
    const r2 = t2.offset, i2 = t2.getNode();
    if (0 === r2) {
      const r3 = i2.getPreviousSibling(), s2 = i2.getParent();
      if (e2) {
        if ((n2 || !e2) && null === r3 && _s(s2) && s2.isInline()) {
          const e3 = s2.getPreviousSibling();
          oi(e3) && (t2.key = e3.__key, t2.offset = e3.getTextContent().length);
        }
      } else _s(r3) && !n2 && r3.isInline() ? (t2.key = r3.__key, t2.offset = r3.getChildrenSize(), t2.type = "element") : oi(r3) && (t2.key = r3.__key, t2.offset = r3.getTextContent().length);
    } else if (r2 === i2.getTextContent().length) {
      const r3 = i2.getNextSibling(), s2 = i2.getParent();
      if (e2 && _s(r3) && r3.isInline()) t2.key = r3.__key, t2.offset = 0, t2.type = "element";
      else if ((n2 || e2) && null === r3 && _s(s2) && s2.isInline() && !s2.canInsertTextAfter()) {
        const e3 = s2.getNextSibling();
        oi(e3) && (t2.key = e3.__key, t2.offset = 0);
      }
    }
  }
  function bi(t2, e2, n2) {
    if ("text" === t2.type && "text" === e2.type) {
      const r2 = t2.isBefore(e2), i2 = t2.is(e2);
      ki(t2, r2, i2), ki(e2, !r2, i2), i2 && (e2.key = t2.key, e2.offset = t2.offset, e2.type = t2.type);
      const s2 = ts();
      if (s2.isComposing() && s2._compositionKey !== t2.key && yi(n2)) {
        const r3 = n2.anchor, i3 = n2.focus;
        _i(t2, r3.key, r3.offset, r3.type), _i(e2, i3.key, i3.offset, i3.type);
      }
    }
  }
  function wi(t2, e2, n2, r2, i2, s2) {
    if (null === t2 || null === n2 || !le(i2, t2, n2)) return null;
    const o2 = Ci(t2, e2, yi(s2) ? s2.anchor : null, i2);
    if (null === o2) return null;
    const l2 = Ci(n2, r2, yi(s2) ? s2.focus : null, i2);
    if (null === l2) return null;
    if ("element" === o2.type && "element" === l2.type) {
      const e3 = Pe(t2), r3 = Pe(n2);
      if (ms(e3) && ms(r3)) return null;
    }
    return bi(o2, l2, s2), [o2, l2];
  }
  function Ni(t2) {
    return _s(t2) && !t2.isInline();
  }
  function Ei(t2, e2, n2, r2, i2, s2) {
    const o2 = Gi(), l2 = new mi(di(t2, e2, i2), di(n2, r2, s2), 0, "");
    return l2.dirty = true, o2._selection = l2, l2;
  }
  function Pi() {
    const t2 = di("root", 0, "element"), e2 = di("root", 0, "element");
    return new mi(t2, e2, 0, "");
  }
  function Fi() {
    return new pi(/* @__PURE__ */ new Set());
  }
  function Li(t2, e2, n2, r2) {
    const i2 = n2._window;
    if (null === i2) return null;
    const s2 = r2 || i2.event, o2 = s2 ? s2.type : void 0, l2 = "selectionchange" === o2, c2 = !Jt && (l2 || "beforeinput" === o2 || "compositionstart" === o2 || "compositionend" === o2 || "click" === o2 && s2 && 3 === s2.detail || "drop" === o2 || void 0 === o2);
    let a2, u2, f2, d2;
    if (yi(t2) && !c2) return t2.clone();
    if (null === e2) return null;
    if (a2 = e2.anchorNode, u2 = e2.focusNode, f2 = e2.anchorOffset, d2 = e2.focusOffset, l2 && yi(t2) && !le(n2, a2, u2)) return t2.clone();
    const h2 = wi(a2, f2, u2, d2, n2, t2);
    if (null === h2) return null;
    const [g2, _2] = h2;
    return new mi(g2, _2, yi(t2) ? t2.format : 0, yi(t2) ? t2.style : "");
  }
  function Oi() {
    return Gi()._selection;
  }
  function Ii() {
    return ts()._editorState._selection;
  }
  function Ai(t2, e2, n2, r2 = 1) {
    const i2 = t2.anchor, s2 = t2.focus, o2 = i2.getNode(), l2 = s2.getNode();
    if (!e2.is(o2) && !e2.is(l2)) return;
    const c2 = e2.__key;
    if (t2.isCollapsed()) {
      const e3 = i2.offset;
      if (n2 <= e3 && r2 > 0 || n2 < e3 && r2 < 0) {
        const n3 = Math.max(0, e3 + r2);
        i2.set(c2, n3, "element"), s2.set(c2, n3, "element"), Mi(t2);
      }
    } else {
      const o3 = t2.isBackward(), l3 = o3 ? s2 : i2, a2 = l3.getNode(), u2 = o3 ? i2 : s2, f2 = u2.getNode();
      if (e2.is(a2)) {
        const t3 = l3.offset;
        (n2 <= t3 && r2 > 0 || n2 < t3 && r2 < 0) && l3.set(c2, Math.max(0, t3 + r2), "element");
      }
      if (e2.is(f2)) {
        const t3 = u2.offset;
        (n2 <= t3 && r2 > 0 || n2 < t3 && r2 < 0) && u2.set(c2, Math.max(0, t3 + r2), "element");
      }
    }
    Mi(t2);
  }
  function Mi(t2) {
    const e2 = t2.anchor, n2 = e2.offset, r2 = t2.focus, i2 = r2.offset, s2 = e2.getNode(), o2 = r2.getNode();
    if (t2.isCollapsed()) {
      if (!_s(s2)) return;
      const t3 = s2.getChildrenSize(), i3 = n2 >= t3, o3 = i3 ? s2.getChildAtIndex(t3 - 1) : s2.getChildAtIndex(n2);
      if (oi(o3)) {
        let t4 = 0;
        i3 && (t4 = o3.getTextContentSize()), e2.set(o3.__key, t4, "text"), r2.set(o3.__key, t4, "text");
      }
    } else {
      if (_s(s2)) {
        const t3 = s2.getChildrenSize(), r3 = n2 >= t3, i3 = r3 ? s2.getChildAtIndex(t3 - 1) : s2.getChildAtIndex(n2);
        if (oi(i3)) {
          let t4 = 0;
          r3 && (t4 = i3.getTextContentSize()), e2.set(i3.__key, t4, "text");
        }
      }
      if (_s(o2)) {
        const t3 = o2.getChildrenSize(), e3 = i2 >= t3, n3 = e3 ? o2.getChildAtIndex(t3 - 1) : o2.getChildAtIndex(i2);
        if (oi(n3)) {
          let t4 = 0;
          e3 && (t4 = n3.getTextContentSize()), r2.set(n3.__key, t4, "text");
        }
      }
    }
  }
  function Wi(t2, e2, n2, r2, i2) {
    let s2 = null, o2 = 0, l2 = null;
    null !== r2 ? (s2 = r2.__key, oi(r2) ? (o2 = r2.getTextContentSize(), l2 = "text") : _s(r2) && (o2 = r2.getChildrenSize(), l2 = "element")) : null !== i2 && (s2 = i2.__key, oi(i2) ? l2 = "text" : _s(i2) && (l2 = "element")), null !== s2 && null !== l2 ? t2.set(s2, o2, l2) : (o2 = e2.getIndexWithinParent(), -1 === o2 && (o2 = n2.getChildrenSize()), t2.set(n2.__key, o2, "element"));
  }
  function zi(t2, e2, n2, r2, i2) {
    "text" === t2.type ? (t2.key = n2, e2 || (t2.offset += i2)) : t2.offset > r2.getIndexWithinParent() && (t2.offset -= 1);
  }
  function Bi(t2, e2, n2, r2, i2, s2, o2) {
    const l2 = r2.anchorNode, c2 = r2.focusNode, a2 = r2.anchorOffset, u2 = r2.focusOffset, f2 = document.activeElement;
    if (i2.has("collaboration") && f2 !== s2 || null !== f2 && oe(f2)) return;
    if (!yi(e2)) return void (null !== t2 && le(n2, l2, c2) && r2.removeAllRanges());
    const d2 = e2.anchor, h2 = e2.focus, g2 = d2.key, _2 = h2.key, p2 = tn(n2, g2), y2 = tn(n2, _2), m2 = d2.offset, x2 = h2.offset, v2 = e2.format, S2 = e2.style, T2 = e2.isCollapsed();
    let C2 = p2, k2 = y2, b2 = false;
    if ("text" === d2.type) {
      C2 = he(p2);
      const t3 = d2.getNode();
      b2 = t3.getFormat() !== v2 || t3.getStyle() !== S2;
    } else yi(t2) && "text" === t2.anchor.type && (b2 = true);
    var w2, N2, E2, P2, F2;
    if (("text" === h2.type && (k2 = he(y2)), null !== C2 && null !== k2) && (T2 && (null === t2 || b2 || yi(t2) && (t2.format !== v2 || t2.style !== S2)) && (w2 = v2, N2 = S2, E2 = m2, P2 = g2, F2 = performance.now(), br = [w2, N2, E2, P2, F2]), a2 !== m2 || u2 !== x2 || l2 !== C2 || c2 !== k2 || "Range" === r2.type && T2 || (null !== f2 && s2.contains(f2) || s2.focus({ preventScroll: true }), "element" === d2.type))) {
      try {
        r2.setBaseAndExtent(C2, m2, k2, x2);
      } catch (t3) {
      }
      if (!i2.has("skip-scroll-into-view") && e2.isCollapsed() && null !== s2 && s2 === document.activeElement) {
        const t3 = e2 instanceof mi && "element" === e2.anchor.type ? C2.childNodes[m2] || null : r2.rangeCount > 0 ? r2.getRangeAt(0) : null;
        if (null !== t3) {
          let e3;
          if (t3 instanceof Text) {
            const n3 = document.createRange();
            n3.selectNode(t3), e3 = n3.getBoundingClientRect();
          } else e3 = t3.getBoundingClientRect();
          !(function(t4, e4, n3) {
            const r3 = n3.ownerDocument, i3 = r3.defaultView;
            if (null === i3) return;
            let { top: s3, bottom: o3 } = e4, l3 = 0, c3 = 0, a3 = n3;
            for (; null !== a3; ) {
              const e5 = a3 === r3.body;
              if (e5) l3 = 0, c3 = on(t4).innerHeight;
              else {
                const t5 = a3.getBoundingClientRect();
                l3 = t5.top, c3 = t5.bottom;
              }
              let n4 = 0;
              if (s3 < l3 ? n4 = -(l3 - s3) : o3 > c3 && (n4 = o3 - c3), 0 !== n4) if (e5) i3.scrollBy(0, n4);
              else {
                const t5 = a3.scrollTop;
                a3.scrollTop += n4;
                const e6 = a3.scrollTop - t5;
                s3 -= e6, o3 -= e6;
              }
              if (e5) break;
              a3 = en(a3);
            }
          })(n2, e3, s2);
        }
      }
      Sr = true;
    }
  }
  function Ri(t2) {
    let e2 = Oi() || Ii();
    null === e2 && (e2 = we().selectEnd()), e2.insertNodes(t2);
  }
  function $i(t2) {
    let e2 = t2;
    t2.isCollapsed() || e2.removeText();
    const n2 = Oi();
    yi(n2) && (e2 = n2), yi(e2) || Rt(161);
    const r2 = e2.anchor;
    let i2 = r2.getNode(), s2 = r2.offset;
    for (; !Cn(i2); ) [i2, s2] = Ji(i2, s2);
    return s2;
  }
  function Ji(t2, e2) {
    const n2 = t2.getParent();
    if (!n2) {
      const t3 = Ns();
      return we().append(t3), t3.select(), [we(), 0];
    }
    if (oi(t2)) {
      const r3 = t2.splitText(e2);
      if (0 === r3.length) return [n2, t2.getIndexWithinParent()];
      const i2 = 0 === e2 ? 0 : 1;
      return [n2, r3[0].getIndexWithinParent() + i2];
    }
    if (!_s(t2) || 0 === e2) return [n2, t2.getIndexWithinParent()];
    const r2 = t2.getChildAtIndex(e2);
    if (r2) {
      const n3 = new mi(di(t2.__key, e2, "element"), di(t2.__key, e2, "element"), 0, ""), i2 = t2.insertNewAfter(n3);
      i2 && i2.append(r2, ...r2.getNextSiblings());
    }
    return [n2, t2.getIndexWithinParent() + 1];
  }
  let Ui = null, Vi = null, ji = false, Hi = false, qi = 0;
  const Qi = { characterData: true, childList: true, subtree: true };
  function Xi() {
    return ji || null !== Ui && Ui._readOnly;
  }
  function Yi() {
    ji && Rt(13);
  }
  function Zi() {
    qi > 99 && Rt(14);
  }
  function Gi() {
    return null === Ui && Rt(195, es()), Ui;
  }
  function ts() {
    return null === Vi && Rt(196, es()), Vi;
  }
  function es() {
    let t2 = 0;
    const e2 = /* @__PURE__ */ new Set(), n2 = Ms.version;
    if ("undefined" != typeof window) for (const r3 of document.querySelectorAll("[contenteditable]")) {
      const i2 = ue(r3);
      if (ce(i2)) t2++;
      else if (i2) {
        let t3 = String(i2.constructor.version || "<0.17.1");
        t3 === n2 && (t3 += " (separately built, likely a bundler configuration issue)"), e2.add(t3);
      }
    }
    let r2 = ` Detected on the page: ${t2} compatible editor(s) with version ${n2}`;
    return e2.size && (r2 += ` and incompatible editors with versions ${Array.from(e2).join(", ")}`), r2;
  }
  function ns() {
    return Vi;
  }
  function rs(t2, e2, n2) {
    const r2 = e2.__type, i2 = (function(t3, e3) {
      const n3 = t3._nodes.get(e3);
      return void 0 === n3 && Rt(30, e3), n3;
    })(t2, r2);
    let s2 = n2.get(r2);
    void 0 === s2 && (s2 = Array.from(i2.transforms), n2.set(r2, s2));
    const o2 = s2.length;
    for (let t3 = 0; t3 < o2 && (s2[t3](e2), e2.isAttached()); t3++) ;
  }
  function is(t2, e2) {
    return void 0 !== t2 && t2.__key !== e2 && t2.isAttached();
  }
  function ss(t2) {
    return os(t2, ts()._nodes);
  }
  function os(t2, e2) {
    const n2 = t2.type, r2 = e2.get(n2);
    void 0 === r2 && Rt(17, n2);
    const i2 = r2.klass;
    t2.type !== i2.getType() && Rt(18, i2.name);
    const s2 = i2.importJSON(t2), o2 = t2.children;
    if (_s(s2) && Array.isArray(o2)) for (let t3 = 0; t3 < o2.length; t3++) {
      const n3 = os(o2[t3], e2);
      s2.append(n3);
    }
    return s2;
  }
  function ls(t2, e2, n2) {
    const r2 = Ui, i2 = ji, s2 = Vi;
    Ui = e2, ji = true, Vi = t2;
    try {
      return n2();
    } finally {
      Ui = r2, ji = i2, Vi = s2;
    }
  }
  function cs(t2, n2) {
    const r2 = t2._pendingEditorState, i2 = t2._rootElement, s2 = t2._headless || null === i2;
    if (null === r2) return;
    const o2 = t2._editorState, l2 = o2._selection, c2 = r2._selection, a2 = t2._dirtyType !== st$1, u2 = Ui, f2 = ji, d2 = Vi, h2 = t2._updating, g2 = t2._observer;
    let _2 = null;
    if (t2._pendingEditorState = null, t2._editorState = r2, !s2 && a2 && null !== g2) {
      Vi = t2, Ui = r2, ji = false, t2._updating = true;
      try {
        const e2 = t2._dirtyType, n3 = t2._dirtyElements, i3 = t2._dirtyLeaves;
        g2.disconnect(), _2 = fr(o2, r2, t2, e2, n3, i3);
      } catch (e2) {
        if (e2 instanceof Error && t2._onError(e2), Hi) throw e2;
        return Is(t2, null, i2, r2), Yt(t2), t2._dirtyType = lt$1, Hi = true, cs(t2, o2), void (Hi = false);
      } finally {
        g2.observe(i2, Qi), t2._updating = h2, Ui = u2, ji = f2, Vi = d2;
      }
    }
    r2._readOnly || (r2._readOnly = true);
    const p2 = t2._dirtyLeaves, y2 = t2._dirtyElements, m2 = t2._normalizedNodes, x2 = t2._updateTags, v2 = t2._deferred;
    a2 && (t2._dirtyType = st$1, t2._cloneNotNeeded.clear(), t2._dirtyLeaves = /* @__PURE__ */ new Set(), t2._dirtyElements = /* @__PURE__ */ new Map(), t2._normalizedNodes = /* @__PURE__ */ new Set(), t2._updateTags = /* @__PURE__ */ new Set()), (function(t3, e2) {
      const n3 = t3._decorators;
      let r3 = t3._pendingDecorators || n3;
      const i3 = e2._nodeMap;
      let s3;
      for (s3 in r3) i3.has(s3) || (r3 === n3 && (r3 = ke(t3)), delete r3[s3]);
    })(t2, r2);
    const S2 = s2 ? null : yn(t2._window);
    if (t2._editable && null !== S2 && (a2 || null === c2 || c2.dirty)) {
      Vi = t2, Ui = r2;
      try {
        if (null !== g2 && g2.disconnect(), a2 || null === c2 || c2.dirty) {
          const e2 = t2._blockCursorElement;
          null !== e2 && _n(e2, t2, i2), Bi(l2, c2, t2, S2, x2, i2);
        }
        pn(t2, i2, c2), null !== g2 && g2.observe(i2, Qi);
      } finally {
        Vi = d2, Ui = u2;
      }
    }
    null !== _2 && (function(t3, e2, n3, r3, i3) {
      const s3 = Array.from(t3._listeners.mutation), o3 = s3.length;
      for (let t4 = 0; t4 < o3; t4++) {
        const [o4, l3] = s3[t4], c3 = e2.get(l3);
        void 0 !== c3 && o4(c3, { dirtyLeaves: r3, prevEditorState: i3, updateTags: n3 });
      }
    })(t2, _2, x2, p2, o2), yi(c2) || null === c2 || null !== l2 && l2.is(c2) || t2.dispatchCommand(e, void 0);
    const T2 = t2._pendingDecorators;
    null !== T2 && (t2._decorators = T2, t2._pendingDecorators = null, as("decorator", t2, true, T2)), (function(t3, e2, n3) {
      const r3 = be(e2), i3 = be(n3);
      r3 !== i3 && as("textcontent", t3, true, i3);
    })(t2, n2 || o2, r2), as("update", t2, true, { dirtyElements: y2, dirtyLeaves: p2, editorState: r2, normalizedNodes: m2, prevEditorState: n2 || o2, tags: x2 }), (function(t3, e2) {
      if (t3._deferred = [], 0 !== e2.length) {
        const n3 = t3._updating;
        t3._updating = true;
        try {
          for (let t4 = 0; t4 < e2.length; t4++) e2[t4]();
        } finally {
          t3._updating = n3;
        }
      }
    })(t2, v2), (function(t3) {
      const e2 = t3._updates;
      if (0 !== e2.length) {
        const n3 = e2.shift();
        if (n3) {
          const [e3, r3] = n3;
          ds(t3, e3, r3);
        }
      }
    })(t2);
  }
  function as(t2, e2, n2, ...r2) {
    const i2 = e2._updating;
    e2._updating = n2;
    try {
      const n3 = Array.from(e2._listeners[t2]);
      for (let t3 = 0; t3 < n3.length; t3++) n3[t3].apply(null, r2);
    } finally {
      e2._updating = i2;
    }
  }
  function us(t2, e2, n2) {
    if (false === t2._updating || Vi !== t2) {
      let r3 = false;
      return t2.update((() => {
        r3 = us(t2, e2, n2);
      })), r3;
    }
    const r2 = Le(t2);
    for (let i2 = 4; i2 >= 0; i2--) for (let s2 = 0; s2 < r2.length; s2++) {
      const o2 = r2[s2]._commands.get(e2);
      if (void 0 !== o2) {
        const e3 = o2[i2];
        if (void 0 !== e3) {
          const r3 = Array.from(e3), i3 = r3.length;
          for (let e4 = 0; e4 < i3; e4++) if (true === r3[e4](n2, t2)) return true;
        }
      }
    }
    return false;
  }
  function fs(t2, e2) {
    const n2 = t2._updates;
    let r2 = e2 || false;
    for (; 0 !== n2.length; ) {
      const e3 = n2.shift();
      if (e3) {
        const [n3, i2] = e3;
        let s2, o2;
        if (void 0 !== i2) {
          if (s2 = i2.onUpdate, o2 = i2.tag, i2.skipTransforms && (r2 = true), i2.discrete) {
            const e4 = t2._pendingEditorState;
            null === e4 && Rt(191), e4._flushSync = true;
          }
          s2 && t2._deferred.push(s2), o2 && t2._updateTags.add(o2);
        }
        n3();
      }
    }
    return r2;
  }
  function ds(t2, e2, n2) {
    const r2 = t2._updateTags;
    let i2, s2, o2 = false, l2 = false;
    void 0 !== n2 && (i2 = n2.onUpdate, s2 = n2.tag, null != s2 && r2.add(s2), o2 = n2.skipTransforms || false, l2 = n2.discrete || false), i2 && t2._deferred.push(i2);
    const c2 = t2._editorState;
    let a2 = t2._pendingEditorState, u2 = false;
    (null === a2 || a2._readOnly) && (a2 = t2._pendingEditorState = new Cs(new Map((a2 || c2)._nodeMap)), u2 = true), a2._flushSync = l2;
    const f2 = Ui, d2 = ji, h2 = Vi, g2 = t2._updating;
    Ui = a2, ji = false, t2._updating = true, Vi = t2;
    try {
      u2 && (t2._headless ? null !== c2._selection && (a2._selection = c2._selection.clone()) : a2._selection = (function(t3) {
        const e3 = t3.getEditorState()._selection, n4 = yn(t3._window);
        return yi(e3) || null == e3 ? Li(e3, n4, t3, null) : e3.clone();
      })(t2));
      const n3 = t2._compositionKey;
      e2(), o2 = fs(t2, o2), (function(t3, e3) {
        const n4 = e3.getEditorState()._selection, r4 = t3._selection;
        if (yi(r4)) {
          const t4 = r4.anchor, e4 = r4.focus;
          let i3;
          if ("text" === t4.type && (i3 = t4.getNode(), i3.selectionTransform(n4, r4)), "text" === e4.type) {
            const t5 = e4.getNode();
            i3 !== t5 && t5.selectionTransform(n4, r4);
          }
        }
      })(a2, t2), t2._dirtyType !== st$1 && (o2 ? (function(t3, e3) {
        const n4 = e3._dirtyLeaves, r4 = t3._nodeMap;
        for (const t4 of n4) {
          const e4 = r4.get(t4);
          oi(e4) && e4.isAttached() && e4.isSimpleText() && !e4.isUnmergeable() && te$1(e4);
        }
      })(a2, t2) : (function(t3, e3) {
        const n4 = e3._dirtyLeaves, r4 = e3._dirtyElements, i3 = t3._nodeMap, s3 = ve(), o3 = /* @__PURE__ */ new Map();
        let l3 = n4, c3 = l3.size, a3 = r4, u3 = a3.size;
        for (; c3 > 0 || u3 > 0; ) {
          if (c3 > 0) {
            e3._dirtyLeaves = /* @__PURE__ */ new Set();
            for (const t4 of l3) {
              const r5 = i3.get(t4);
              oi(r5) && r5.isAttached() && r5.isSimpleText() && !r5.isUnmergeable() && te$1(r5), void 0 !== r5 && is(r5, s3) && rs(e3, r5, o3), n4.add(t4);
            }
            if (l3 = e3._dirtyLeaves, c3 = l3.size, c3 > 0) {
              qi++;
              continue;
            }
          }
          e3._dirtyLeaves = /* @__PURE__ */ new Set(), e3._dirtyElements = /* @__PURE__ */ new Map();
          for (const t4 of a3) {
            const n5 = t4[0], l4 = t4[1];
            if ("root" !== n5 && !l4) continue;
            const c4 = i3.get(n5);
            void 0 !== c4 && is(c4, s3) && rs(e3, c4, o3), r4.set(n5, l4);
          }
          l3 = e3._dirtyLeaves, c3 = l3.size, a3 = e3._dirtyElements, u3 = a3.size, qi++;
        }
        e3._dirtyLeaves = n4, e3._dirtyElements = r4;
      })(a2, t2), fs(t2), (function(t3, e3, n4, r4) {
        const i3 = t3._nodeMap, s3 = e3._nodeMap, o3 = [];
        for (const [t4] of r4) {
          const e4 = s3.get(t4);
          void 0 !== e4 && (e4.isAttached() || (_s(e4) && Fn(e4, t4, i3, s3, o3, r4), i3.has(t4) || r4.delete(t4), o3.push(t4)));
        }
        for (const t4 of o3) s3.delete(t4);
        for (const t4 of n4) {
          const e4 = s3.get(t4);
          void 0 === e4 || e4.isAttached() || (i3.has(t4) || n4.delete(t4), s3.delete(t4));
        }
      })(c2, a2, t2._dirtyLeaves, t2._dirtyElements));
      n3 !== t2._compositionKey && (a2._flushSync = true);
      const r3 = a2._selection;
      if (yi(r3)) {
        const t3 = a2._nodeMap, e3 = r3.anchor.key, n4 = r3.focus.key;
        void 0 !== t3.get(e3) && void 0 !== t3.get(n4) || Rt(19);
      } else xi(r3) && 0 === r3._nodes.size && (a2._selection = null);
    } catch (e3) {
      return e3 instanceof Error && t2._onError(e3), t2._pendingEditorState = c2, t2._dirtyType = lt$1, t2._cloneNotNeeded.clear(), t2._dirtyLeaves = /* @__PURE__ */ new Set(), t2._dirtyElements.clear(), void cs(t2);
    } finally {
      Ui = f2, ji = d2, Vi = h2, t2._updating = g2, qi = 0;
    }
    const _2 = t2._dirtyType !== st$1 || (function(t3, e3) {
      const n3 = e3.getEditorState()._selection, r3 = t3._selection;
      if (null !== r3) {
        if (r3.dirty || !r3.is(n3)) return true;
      } else if (null !== n3) return true;
      return false;
    })(a2, t2);
    _2 ? a2._flushSync ? (a2._flushSync = false, cs(t2)) : u2 && se((() => {
      cs(t2);
    })) : (a2._flushSync = false, u2 && (r2.clear(), t2._deferred = [], t2._pendingEditorState = null));
  }
  function hs(t2, e2, n2) {
    t2._updating ? t2._updates.push([e2, n2]) : ds(t2, e2, n2);
  }
  class gs extends zr {
    constructor(t2) {
      super(t2), this.__first = null, this.__last = null, this.__size = 0, this.__format = 0, this.__style = "", this.__indent = 0, this.__dir = null;
    }
    afterCloneFrom(t2) {
      super.afterCloneFrom(t2), this.__first = t2.__first, this.__last = t2.__last, this.__size = t2.__size, this.__indent = t2.__indent, this.__format = t2.__format, this.__style = t2.__style, this.__dir = t2.__dir;
    }
    getFormat() {
      return this.getLatest().__format;
    }
    getFormatType() {
      const t2 = this.getFormat();
      return Mt[t2] || "";
    }
    getStyle() {
      return this.getLatest().__style;
    }
    getIndent() {
      return this.getLatest().__indent;
    }
    getChildren() {
      const t2 = [];
      let e2 = this.getFirstChild();
      for (; null !== e2; ) t2.push(e2), e2 = e2.getNextSibling();
      return t2;
    }
    getChildrenKeys() {
      const t2 = [];
      let e2 = this.getFirstChild();
      for (; null !== e2; ) t2.push(e2.__key), e2 = e2.getNextSibling();
      return t2;
    }
    getChildrenSize() {
      return this.getLatest().__size;
    }
    isEmpty() {
      return 0 === this.getChildrenSize();
    }
    isDirty() {
      const t2 = ts()._dirtyElements;
      return null !== t2 && t2.has(this.__key);
    }
    isLastChild() {
      const t2 = this.getLatest(), e2 = this.getParentOrThrow().getLastChild();
      return null !== e2 && e2.is(t2);
    }
    getAllTextNodes() {
      const t2 = [];
      let e2 = this.getFirstChild();
      for (; null !== e2; ) {
        if (oi(e2) && t2.push(e2), _s(e2)) {
          const n2 = e2.getAllTextNodes();
          t2.push(...n2);
        }
        e2 = e2.getNextSibling();
      }
      return t2;
    }
    getFirstDescendant() {
      let t2 = this.getFirstChild();
      for (; _s(t2); ) {
        const e2 = t2.getFirstChild();
        if (null === e2) break;
        t2 = e2;
      }
      return t2;
    }
    getLastDescendant() {
      let t2 = this.getLastChild();
      for (; _s(t2); ) {
        const e2 = t2.getLastChild();
        if (null === e2) break;
        t2 = e2;
      }
      return t2;
    }
    getDescendantByIndex(t2) {
      const e2 = this.getChildren(), n2 = e2.length;
      if (t2 >= n2) {
        const t3 = e2[n2 - 1];
        return _s(t3) && t3.getLastDescendant() || t3 || null;
      }
      const r2 = e2[t2];
      return _s(r2) && r2.getFirstDescendant() || r2 || null;
    }
    getFirstChild() {
      const t2 = this.getLatest().__first;
      return null === t2 ? null : Se(t2);
    }
    getFirstChildOrThrow() {
      const t2 = this.getFirstChild();
      return null === t2 && Rt(45, this.__key), t2;
    }
    getLastChild() {
      const t2 = this.getLatest().__last;
      return null === t2 ? null : Se(t2);
    }
    getLastChildOrThrow() {
      const t2 = this.getLastChild();
      return null === t2 && Rt(96, this.__key), t2;
    }
    getChildAtIndex(t2) {
      const e2 = this.getChildrenSize();
      let n2, r2;
      if (t2 < e2 / 2) {
        for (n2 = this.getFirstChild(), r2 = 0; null !== n2 && r2 <= t2; ) {
          if (r2 === t2) return n2;
          n2 = n2.getNextSibling(), r2++;
        }
        return null;
      }
      for (n2 = this.getLastChild(), r2 = e2 - 1; null !== n2 && r2 >= t2; ) {
        if (r2 === t2) return n2;
        n2 = n2.getPreviousSibling(), r2--;
      }
      return null;
    }
    getTextContent() {
      let t2 = "";
      const e2 = this.getChildren(), n2 = e2.length;
      for (let r2 = 0; r2 < n2; r2++) {
        const i2 = e2[r2];
        t2 += i2.getTextContent(), _s(i2) && r2 !== n2 - 1 && !i2.isInline() && (t2 += Nt$1);
      }
      return t2;
    }
    getTextContentSize() {
      let t2 = 0;
      const e2 = this.getChildren(), n2 = e2.length;
      for (let r2 = 0; r2 < n2; r2++) {
        const i2 = e2[r2];
        t2 += i2.getTextContentSize(), _s(i2) && r2 !== n2 - 1 && !i2.isInline() && (t2 += Nt$1.length);
      }
      return t2;
    }
    getDirection() {
      return this.getLatest().__dir;
    }
    hasFormat(t2) {
      if ("" !== t2) {
        const e2 = At[t2];
        return !!(this.getFormat() & e2);
      }
      return false;
    }
    select(t2, e2) {
      Yi();
      const n2 = Oi();
      let r2 = t2, i2 = e2;
      const s2 = this.getChildrenSize();
      if (!this.canBeEmpty()) {
        if (0 === t2 && 0 === e2) {
          const t3 = this.getFirstChild();
          if (oi(t3) || _s(t3)) return t3.select(0, 0);
        } else if (!(void 0 !== t2 && t2 !== s2 || void 0 !== e2 && e2 !== s2)) {
          const t3 = this.getLastChild();
          if (oi(t3) || _s(t3)) return t3.select();
        }
      }
      void 0 === r2 && (r2 = s2), void 0 === i2 && (i2 = s2);
      const o2 = this.__key;
      return yi(n2) ? (n2.anchor.set(o2, r2, "element"), n2.focus.set(o2, i2, "element"), n2.dirty = true, n2) : Ei(o2, r2, o2, i2, "element", "element");
    }
    selectStart() {
      const t2 = this.getFirstDescendant();
      return t2 ? t2.selectStart() : this.select();
    }
    selectEnd() {
      const t2 = this.getLastDescendant();
      return t2 ? t2.selectEnd() : this.select();
    }
    clear() {
      const t2 = this.getWritable();
      return this.getChildren().forEach(((t3) => t3.remove())), t2;
    }
    append(...t2) {
      return this.splice(this.getChildrenSize(), 0, t2);
    }
    setDirection(t2) {
      const e2 = this.getWritable();
      return e2.__dir = t2, e2;
    }
    setFormat(t2) {
      return this.getWritable().__format = "" !== t2 ? At[t2] : 0, this;
    }
    setStyle(t2) {
      return this.getWritable().__style = t2 || "", this;
    }
    setIndent(t2) {
      return this.getWritable().__indent = t2, this;
    }
    splice(t2, e2, n2) {
      const r2 = n2.length, i2 = this.getChildrenSize(), s2 = this.getWritable(), o2 = s2.__key, l2 = [], c2 = [], a2 = this.getChildAtIndex(t2 + e2);
      let u2 = null, f2 = i2 - e2 + r2;
      if (0 !== t2) if (t2 === i2) u2 = this.getLastChild();
      else {
        const e3 = this.getChildAtIndex(t2);
        null !== e3 && (u2 = e3.getPreviousSibling());
      }
      if (e2 > 0) {
        let t3 = null === u2 ? this.getFirstChild() : u2.getNextSibling();
        for (let n3 = 0; n3 < e2; n3++) {
          null === t3 && Rt(100);
          const e3 = t3.getNextSibling(), n4 = t3.__key;
          ye(t3.getWritable()), c2.push(n4), t3 = e3;
        }
      }
      let d2 = u2;
      for (let t3 = 0; t3 < r2; t3++) {
        const e3 = n2[t3];
        null !== d2 && e3.is(d2) && (u2 = d2 = d2.getPreviousSibling());
        const r3 = e3.getWritable();
        r3.__parent === o2 && f2--, ye(r3);
        const i3 = e3.__key;
        if (null === d2) s2.__first = i3, r3.__prev = null;
        else {
          const t4 = d2.getWritable();
          t4.__next = i3, r3.__prev = t4.__key;
        }
        e3.__key === o2 && Rt(76), r3.__parent = o2, l2.push(i3), d2 = e3;
      }
      if (t2 + e2 === i2) {
        if (null !== d2) {
          d2.getWritable().__next = null, s2.__last = d2.__key;
        }
      } else if (null !== a2) {
        const t3 = a2.getWritable();
        if (null !== d2) {
          const e3 = d2.getWritable();
          t3.__prev = d2.__key, e3.__next = a2.__key;
        } else t3.__prev = null;
      }
      if (s2.__size = f2, c2.length) {
        const t3 = Oi();
        if (yi(t3)) {
          const e3 = new Set(c2), n3 = new Set(l2), { anchor: r3, focus: i3 } = t3;
          ps(r3, e3, n3) && Wi(r3, r3.getNode(), this, u2, a2), ps(i3, e3, n3) && Wi(i3, i3.getNode(), this, u2, a2), 0 !== f2 || this.canBeEmpty() || an(this) || this.remove();
        }
      }
      return s2;
    }
    exportJSON() {
      return { children: [], direction: this.getDirection(), format: this.getFormatType(), indent: this.getIndent(), type: "element", version: 1 };
    }
    insertNewAfter(t2, e2) {
      return null;
    }
    canIndent() {
      return true;
    }
    collapseAtStart(t2) {
      return false;
    }
    excludeFromCopy(t2) {
      return false;
    }
    canReplaceWith(t2) {
      return true;
    }
    canInsertAfter(t2) {
      return true;
    }
    canBeEmpty() {
      return true;
    }
    canInsertTextBefore() {
      return true;
    }
    canInsertTextAfter() {
      return true;
    }
    isInline() {
      return false;
    }
    isShadowRoot() {
      return false;
    }
    canMergeWith(t2) {
      return false;
    }
    extractWithChild(t2, e2, n2) {
      return false;
    }
    canMergeWhenEmpty() {
      return false;
    }
  }
  function _s(t2) {
    return t2 instanceof gs;
  }
  function ps(t2, e2, n2) {
    let r2 = t2.getNode();
    for (; r2; ) {
      const t3 = r2.__key;
      if (e2.has(t3) && !n2.has(t3)) return true;
      r2 = r2.getParent();
    }
    return false;
  }
  class ys extends zr {
    constructor(t2) {
      super(t2);
    }
    decorate(t2, e2) {
      Rt(47);
    }
    isIsolated() {
      return false;
    }
    isInline() {
      return true;
    }
    isKeyboardSelectable() {
      return true;
    }
  }
  function ms(t2) {
    return t2 instanceof ys;
  }
  class xs extends gs {
    static getType() {
      return "root";
    }
    static clone() {
      return new xs();
    }
    constructor() {
      super("root"), this.__cachedText = null;
    }
    getTopLevelElementOrThrow() {
      Rt(51);
    }
    getTextContent() {
      const t2 = this.__cachedText;
      return !Xi() && ts()._dirtyType !== st$1 || null === t2 ? super.getTextContent() : t2;
    }
    remove() {
      Rt(52);
    }
    replace(t2) {
      Rt(53);
    }
    insertBefore(t2) {
      Rt(54);
    }
    insertAfter(t2) {
      Rt(55);
    }
    updateDOM(t2, e2) {
      return false;
    }
    append(...t2) {
      for (let e2 = 0; e2 < t2.length; e2++) {
        const n2 = t2[e2];
        _s(n2) || ms(n2) || Rt(56);
      }
      return super.append(...t2);
    }
    static importJSON(t2) {
      const e2 = we();
      return e2.setFormat(t2.format), e2.setIndent(t2.indent), e2.setDirection(t2.direction), e2;
    }
    exportJSON() {
      return { children: [], direction: this.getDirection(), format: this.getFormatType(), indent: this.getIndent(), type: "root", version: 1 };
    }
    collapseAtStart() {
      return true;
    }
  }
  function vs(t2) {
    return t2 instanceof xs;
  }
  function Ss() {
    return new Cs(/* @__PURE__ */ new Map([["root", new xs()]]));
  }
  function Ts(t2) {
    const e2 = t2.exportJSON(), n2 = t2.constructor;
    if (e2.type !== n2.getType() && Rt(130, n2.name), _s(t2)) {
      const r2 = e2.children;
      Array.isArray(r2) || Rt(59, n2.name);
      const i2 = t2.getChildren();
      for (let t3 = 0; t3 < i2.length; t3++) {
        const e3 = Ts(i2[t3]);
        r2.push(e3);
      }
    }
    return e2;
  }
  class Cs {
    constructor(t2, e2) {
      this._nodeMap = t2, this._selection = e2 || null, this._flushSync = false, this._readOnly = false;
    }
    isEmpty() {
      return 1 === this._nodeMap.size && null === this._selection;
    }
    read(t2, e2) {
      return ls(e2 && e2.editor || null, this, t2);
    }
    clone(t2) {
      const e2 = new Cs(this._nodeMap, void 0 === t2 ? this._selection : t2);
      return e2._readOnly = true, e2;
    }
    toJSON() {
      return ls(null, this, (() => ({ root: Ts(we()) })));
    }
  }
  class ks extends gs {
    static getType() {
      return "artificial";
    }
    createDOM(t2) {
      return document.createElement("div");
    }
  }
  class bs extends gs {
    constructor(t2) {
      super(t2), this.__textFormat = 0, this.__textStyle = "";
    }
    static getType() {
      return "paragraph";
    }
    getTextFormat() {
      return this.getLatest().__textFormat;
    }
    setTextFormat(t2) {
      const e2 = this.getWritable();
      return e2.__textFormat = t2, e2;
    }
    hasTextFormat(t2) {
      const e2 = Ot$1[t2];
      return !!(this.getTextFormat() & e2);
    }
    getTextStyle() {
      return this.getLatest().__textStyle;
    }
    setTextStyle(t2) {
      const e2 = this.getWritable();
      return e2.__textStyle = t2, e2;
    }
    static clone(t2) {
      return new bs(t2.__key);
    }
    afterCloneFrom(t2) {
      super.afterCloneFrom(t2), this.__textFormat = t2.__textFormat, this.__textStyle = t2.__textStyle;
    }
    createDOM(t2) {
      const e2 = document.createElement("p"), n2 = je(t2.theme, "paragraph");
      if (void 0 !== n2) {
        e2.classList.add(...n2);
      }
      return e2;
    }
    updateDOM(t2, e2, n2) {
      return false;
    }
    static importDOM() {
      return { p: (t2) => ({ conversion: ws, priority: 0 }) };
    }
    exportDOM(t2) {
      const { element: e2 } = super.exportDOM(t2);
      if (e2 && vn(e2)) {
        this.isEmpty() && e2.append(document.createElement("br"));
        const t3 = this.getFormatType();
        e2.style.textAlign = t3;
        const n2 = this.getDirection();
        n2 && (e2.dir = n2);
        const r2 = this.getIndent();
        r2 > 0 && (e2.style.textIndent = 20 * r2 + "px");
      }
      return { element: e2 };
    }
    static importJSON(t2) {
      const e2 = Ns();
      return e2.setFormat(t2.format), e2.setIndent(t2.indent), e2.setDirection(t2.direction), e2.setTextFormat(t2.textFormat), e2;
    }
    exportJSON() {
      return __spreadProps(__spreadValues({}, super.exportJSON()), { textFormat: this.getTextFormat(), textStyle: this.getTextStyle(), type: "paragraph", version: 1 });
    }
    insertNewAfter(t2, e2) {
      const n2 = Ns();
      n2.setTextFormat(t2.format), n2.setTextStyle(t2.style);
      const r2 = this.getDirection();
      return n2.setDirection(r2), n2.setFormat(this.getFormatType()), n2.setStyle(this.getTextStyle()), this.insertAfter(n2, e2), n2;
    }
    collapseAtStart() {
      const t2 = this.getChildren();
      if (0 === t2.length || oi(t2[0]) && "" === t2[0].getTextContent().trim()) {
        if (null !== this.getNextSibling()) return this.selectNext(), this.remove(), true;
        if (null !== this.getPreviousSibling()) return this.selectPrevious(), this.remove(), true;
      }
      return false;
    }
  }
  function ws(t2) {
    const e2 = Ns();
    if (t2.style) {
      e2.setFormat(t2.style.textAlign);
      const n2 = parseInt(t2.style.textIndent, 10) / 20;
      n2 > 0 && e2.setIndent(n2);
    }
    return { node: e2 };
  }
  function Ns() {
    return fn(new bs());
  }
  function Es(t2) {
    return t2 instanceof bs;
  }
  const Ps = 0, Fs = 1, Os = 4;
  function Is(t2, e2, n2, r2) {
    const i2 = t2._keyToDOMMap;
    i2.clear(), t2._editorState = Ss(), t2._pendingEditorState = r2, t2._compositionKey = null, t2._dirtyType = st$1, t2._cloneNotNeeded.clear(), t2._dirtyLeaves = /* @__PURE__ */ new Set(), t2._dirtyElements.clear(), t2._normalizedNodes = /* @__PURE__ */ new Set(), t2._updateTags = /* @__PURE__ */ new Set(), t2._updates = [], t2._blockCursorElement = null;
    const s2 = t2._observer;
    null !== s2 && (s2.disconnect(), t2._observer = null), null !== e2 && (e2.textContent = ""), null !== n2 && (n2.textContent = "", i2.set("root", n2));
  }
  function As(t2) {
    const e2 = t2 || {}, n2 = ns(), r2 = e2.theme || {}, i2 = void 0 === t2 ? n2 : e2.parentEditor || null, s2 = e2.disableEvents || false, o2 = Ss(), l2 = e2.namespace || (null !== i2 ? i2._config.namespace : Oe()), c2 = e2.editorState, a2 = [xs, Xr, Br, ci, bs, ks, ...e2.nodes || []], { onError: u2, html: f2 } = e2, d2 = void 0 === e2.editable || e2.editable;
    let h2;
    if (void 0 === t2 && null !== n2) h2 = n2._nodes;
    else {
      h2 = /* @__PURE__ */ new Map();
      for (let t3 = 0; t3 < a2.length; t3++) {
        let e3 = a2[t3], n3 = null, r3 = null;
        if ("function" != typeof e3) {
          const t4 = e3;
          e3 = t4.replace, n3 = t4.with, r3 = t4.withKlass || null;
        }
        const i3 = e3.getType(), s3 = e3.transform(), o3 = /* @__PURE__ */ new Set();
        null !== s3 && o3.add(s3), h2.set(i3, { exportDOM: f2 && f2.export ? f2.export.get(e3) : void 0, klass: e3, replace: n3, replaceWithKlass: r3, transforms: o3 });
      }
    }
    const g2 = new Ms(o2, i2, h2, { disableEvents: s2, namespace: l2, theme: r2 }, u2 || console.error, (function(t3, e3) {
      const n3 = /* @__PURE__ */ new Map(), r3 = /* @__PURE__ */ new Set(), i3 = (t4) => {
        Object.keys(t4).forEach(((e4) => {
          let r4 = n3.get(e4);
          void 0 === r4 && (r4 = [], n3.set(e4, r4)), r4.push(t4[e4]);
        }));
      };
      return t3.forEach(((t4) => {
        const e4 = t4.klass.importDOM;
        if (null == e4 || r3.has(e4)) return;
        r3.add(e4);
        const n4 = e4.call(t4.klass);
        null !== n4 && i3(n4);
      })), e3 && i3(e3), n3;
    })(h2, f2 ? f2.import : void 0), d2);
    return void 0 !== c2 && (g2._pendingEditorState = c2, g2._dirtyType = lt$1), g2;
  }
  class Ms {
    constructor(t2, e2, n2, r2, i2, s2, o2) {
      this._parentEditor = e2, this._rootElement = null, this._editorState = t2, this._pendingEditorState = null, this._compositionKey = null, this._deferred = [], this._keyToDOMMap = /* @__PURE__ */ new Map(), this._updates = [], this._updating = false, this._listeners = { decorator: /* @__PURE__ */ new Set(), editable: /* @__PURE__ */ new Set(), mutation: /* @__PURE__ */ new Map(), root: /* @__PURE__ */ new Set(), textcontent: /* @__PURE__ */ new Set(), update: /* @__PURE__ */ new Set() }, this._commands = /* @__PURE__ */ new Map(), this._config = r2, this._nodes = n2, this._decorators = {}, this._pendingDecorators = null, this._dirtyType = st$1, this._cloneNotNeeded = /* @__PURE__ */ new Set(), this._dirtyLeaves = /* @__PURE__ */ new Set(), this._dirtyElements = /* @__PURE__ */ new Map(), this._normalizedNodes = /* @__PURE__ */ new Set(), this._updateTags = /* @__PURE__ */ new Set(), this._observer = null, this._key = Oe(), this._onError = i2, this._htmlConversions = s2, this._editable = o2, this._headless = null !== e2 && e2._headless, this._window = null, this._blockCursorElement = null;
    }
    isComposing() {
      return null != this._compositionKey;
    }
    registerUpdateListener(t2) {
      const e2 = this._listeners.update;
      return e2.add(t2), () => {
        e2.delete(t2);
      };
    }
    registerEditableListener(t2) {
      const e2 = this._listeners.editable;
      return e2.add(t2), () => {
        e2.delete(t2);
      };
    }
    registerDecoratorListener(t2) {
      const e2 = this._listeners.decorator;
      return e2.add(t2), () => {
        e2.delete(t2);
      };
    }
    registerTextContentListener(t2) {
      const e2 = this._listeners.textcontent;
      return e2.add(t2), () => {
        e2.delete(t2);
      };
    }
    registerRootListener(t2) {
      const e2 = this._listeners.root;
      return t2(this._rootElement, null), e2.add(t2), () => {
        t2(null, this._rootElement), e2.delete(t2);
      };
    }
    registerCommand(t2, e2, n2) {
      void 0 === n2 && Rt(35);
      const r2 = this._commands;
      r2.has(t2) || r2.set(t2, [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()]);
      const i2 = r2.get(t2);
      void 0 === i2 && Rt(36, String(t2));
      const s2 = i2[n2];
      return s2.add(e2), () => {
        s2.delete(e2), i2.every(((t3) => 0 === t3.size)) && r2.delete(t2);
      };
    }
    registerMutationListener(t2, e2, n2) {
      const r2 = this.resolveRegisteredNodeAfterReplacements(this.getRegisteredNode(t2)).klass, i2 = this._listeners.mutation;
      i2.set(e2, r2);
      const s2 = n2 && n2.skipInitialization;
      return void 0 === s2 || s2 || this.initializeMutationListener(e2, r2), () => {
        i2.delete(e2);
      };
    }
    getRegisteredNode(t2) {
      const e2 = this._nodes.get(t2.getType());
      return void 0 === e2 && Rt(37, t2.name), e2;
    }
    resolveRegisteredNodeAfterReplacements(t2) {
      for (; t2.replaceWithKlass; ) t2 = this.getRegisteredNode(t2.replaceWithKlass);
      return t2;
    }
    initializeMutationListener(t2, e2) {
      const n2 = this._editorState, r2 = En(n2).get(e2.getType());
      if (!r2) return;
      const i2 = /* @__PURE__ */ new Map();
      for (const t3 of r2.keys()) i2.set(t3, "created");
      i2.size > 0 && t2(i2, { dirtyLeaves: /* @__PURE__ */ new Set(), prevEditorState: n2, updateTags: /* @__PURE__ */ new Set(["registerMutationListener"]) });
    }
    registerNodeTransformToKlass(t2, e2) {
      const n2 = this.getRegisteredNode(t2);
      return n2.transforms.add(e2), n2;
    }
    registerNodeTransform(t2, e2) {
      const n2 = this.registerNodeTransformToKlass(t2, e2), r2 = [n2], i2 = n2.replaceWithKlass;
      if (null != i2) {
        const t3 = this.registerNodeTransformToKlass(i2, e2);
        r2.push(t3);
      }
      var s2, o2;
      return s2 = this, o2 = t2.getType(), hs(s2, (() => {
        const t3 = Gi();
        if (t3.isEmpty()) return;
        if ("root" === o2) return void we().markDirty();
        const e3 = t3._nodeMap;
        for (const [, t4] of e3) t4.markDirty();
      }), null === s2._pendingEditorState ? { tag: "history-merge" } : void 0), () => {
        r2.forEach(((t3) => t3.transforms.delete(e2)));
      };
    }
    hasNode(t2) {
      return this._nodes.has(t2.getType());
    }
    hasNodes(t2) {
      return t2.every(this.hasNode.bind(this));
    }
    dispatchCommand(t2, e2) {
      return Ze(this, t2, e2);
    }
    getDecorators() {
      return this._decorators;
    }
    getRootElement() {
      return this._rootElement;
    }
    getKey() {
      return this._key;
    }
    setRootElement(t2) {
      const e2 = this._rootElement;
      if (t2 !== e2) {
        const n2 = je(this._config.theme, "root"), r2 = this._pendingEditorState || this._editorState;
        if (this._rootElement = t2, Is(this, e2, t2, r2), null !== e2 && (this._config.disableEvents || Mr(e2), null != n2 && e2.classList.remove(...n2)), null !== t2) {
          const e3 = (function(t3) {
            const e4 = t3.ownerDocument;
            return e4 && e4.defaultView || null;
          })(t2), r3 = t2.style;
          r3.userSelect = "text", r3.whiteSpace = "pre-wrap", r3.wordBreak = "break-word", t2.setAttribute("data-lexical-editor", "true"), this._window = e3, this._dirtyType = lt$1, Yt(this), this._updateTags.add("history-merge"), cs(this), this._config.disableEvents || (function(t3, e4) {
            const n3 = t3.ownerDocument, r4 = vr.get(n3);
            (void 0 === r4 || r4 < 1) && n3.addEventListener("selectionchange", Or), vr.set(n3, (r4 || 0) + 1), t3.__lexicalEditor = e4;
            const i2 = Dr(t3);
            for (let n4 = 0; n4 < _r.length; n4++) {
              const [r5, s2] = _r[n4], o2 = "function" == typeof s2 ? (t4) => {
                Ar(t4) || (Ir(t4), (e4.isEditable() || "click" === r5) && s2(t4, e4));
              } : (t4) => {
                if (Ar(t4)) return;
                Ir(t4);
                const n5 = e4.isEditable();
                switch (r5) {
                  case "cut":
                    return n5 && Ze(e4, W$1, t4);
                  case "copy":
                    return Ze(e4, M$5, t4);
                  case "paste":
                    return n5 && Ze(e4, c$3, t4);
                  case "dragstart":
                    return n5 && Ze(e4, O$4, t4);
                  case "dragover":
                    return n5 && Ze(e4, I$3, t4);
                  case "dragend":
                    return n5 && Ze(e4, A$4, t4);
                  case "focus":
                    return n5 && Ze(e4, J$4, t4);
                  case "blur":
                    return n5 && Ze(e4, U$4, t4);
                  case "drop":
                    return n5 && Ze(e4, D$4, t4);
                }
              };
              t3.addEventListener(r5, o2), i2.push((() => {
                t3.removeEventListener(r5, o2);
              }));
            }
          })(t2, this), null != n2 && t2.classList.add(...n2);
        } else this._editorState = r2, this._pendingEditorState = null, this._window = null;
        as("root", this, false, t2, e2);
      }
    }
    getElementByKey(t2) {
      return this._keyToDOMMap.get(t2) || null;
    }
    getEditorState() {
      return this._editorState;
    }
    setEditorState(t2, e2) {
      t2.isEmpty() && Rt(38), Xt(this);
      const n2 = this._pendingEditorState, r2 = this._updateTags, i2 = void 0 !== e2 ? e2.tag : null;
      null === n2 || n2.isEmpty() || (null != i2 && r2.add(i2), cs(this)), this._pendingEditorState = t2, this._dirtyType = lt$1, this._dirtyElements.set("root", false), this._compositionKey = null, null != i2 && r2.add(i2), cs(this);
    }
    parseEditorState(t2, e2) {
      return (function(t3, e3, n2) {
        const r2 = Ss(), i2 = Ui, s2 = ji, o2 = Vi, l2 = e3._dirtyElements, c2 = e3._dirtyLeaves, a2 = e3._cloneNotNeeded, u2 = e3._dirtyType;
        e3._dirtyElements = /* @__PURE__ */ new Map(), e3._dirtyLeaves = /* @__PURE__ */ new Set(), e3._cloneNotNeeded = /* @__PURE__ */ new Set(), e3._dirtyType = 0, Ui = r2, ji = false, Vi = e3;
        try {
          const i3 = e3._nodes;
          os(t3.root, i3), n2 && n2(), r2._readOnly = true;
        } catch (t4) {
          t4 instanceof Error && e3._onError(t4);
        } finally {
          e3._dirtyElements = l2, e3._dirtyLeaves = c2, e3._cloneNotNeeded = a2, e3._dirtyType = u2, Ui = i2, ji = s2, Vi = o2;
        }
        return r2;
      })("string" == typeof t2 ? JSON.parse(t2) : t2, this, e2);
    }
    read(t2) {
      return cs(this), this.getEditorState().read(t2, { editor: this });
    }
    update(t2, e2) {
      hs(this, t2, e2);
    }
    focus(t2, e2 = {}) {
      const n2 = this._rootElement;
      null !== n2 && (n2.setAttribute("autocapitalize", "off"), hs(this, (() => {
        const t3 = Oi(), n3 = we();
        null !== t3 ? t3.dirty = true : 0 !== n3.getChildrenSize() && ("rootStart" === e2.defaultSelection ? n3.selectStart() : n3.selectEnd());
      }), { onUpdate: () => {
        n2.removeAttribute("autocapitalize"), t2 && t2();
      }, tag: "focus" }), null === this._pendingEditorState && n2.removeAttribute("autocapitalize"));
    }
    blur() {
      const t2 = this._rootElement;
      null !== t2 && t2.blur();
      const e2 = yn(this._window);
      null !== e2 && e2.removeAllRanges();
    }
    isEditable() {
      return this._editable;
    }
    setEditable(t2) {
      this._editable !== t2 && (this._editable = t2, as("editable", this, true, t2));
    }
    toJSON() {
      return { editorState: this._editorState.toJSON() };
    }
  }
  Ms.version = "0.17.1+prod.esm";
  function m$6(e2) {
    return e2 && e2.__esModule && Object.prototype.hasOwnProperty.call(e2, "default") ? e2.default : e2;
  }
  var T$2 = m$6((function(e2) {
    const t2 = new URLSearchParams();
    t2.append("code", e2);
    for (let e3 = 1; e3 < arguments.length; e3++) t2.append("v", arguments[e3]);
    throw Error(`Minified Lexical error #${e2}; visit https://lexical.dev/docs/error?${t2} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }));
  const x$4 = /* @__PURE__ */ new Map();
  function w$4(e2) {
    const t2 = {}, n2 = e2.split(";");
    for (const e3 of n2) if ("" !== e3) {
      const [n3, l2] = e3.split(/:([^]+)/);
      n3 && l2 && (t2[n3.trim()] = l2.trim());
    }
    return t2;
  }
  function N$2(e2) {
    let t2 = x$4.get(e2);
    return void 0 === t2 && (t2 = w$4(e2), x$4.set(e2, t2)), t2;
  }
  function E$5(e2, n2) {
    const l2 = e2.getStartEndPoints();
    if (n2.isSelected(e2) && !n2.isSegmented() && !n2.isToken() && null !== l2) {
      const [o2, r2] = l2, s2 = e2.isBackward(), i2 = o2.getNode(), c2 = r2.getNode(), f2 = n2.is(i2), u2 = n2.is(c2);
      if (f2 || u2) {
        const [l3, o3] = Si(e2), r3 = i2.is(c2), f3 = n2.is(s2 ? c2 : i2), u3 = n2.is(s2 ? i2 : c2);
        let g2, a2 = 0;
        if (r3) a2 = l3 > o3 ? o3 : l3, g2 = l3 > o3 ? l3 : o3;
        else if (f3) {
          a2 = s2 ? o3 : l3, g2 = void 0;
        } else if (u3) {
          a2 = 0, g2 = s2 ? l3 : o3;
        }
        return n2.__text = n2.__text.slice(a2, g2), n2;
      }
    }
    return n2;
  }
  function I$2(e2) {
    const t2 = e2.getStyle(), n2 = w$4(t2);
    x$4.set(t2, n2);
  }
  function O$3(e2, t2) {
    const n2 = N$2("getStyle" in e2 ? e2.getStyle() : e2.style), l2 = Object.entries(t2).reduce(((t3, [l3, o3]) => ("function" == typeof o3 ? t3[l3] = o3(n2[l3], e2) : null === o3 ? delete t3[l3] : t3[l3] = o3, t3)), __spreadValues({}, n2) || {}), o2 = (function(e3) {
      let t3 = "";
      for (const n3 in e3) n3 && (t3 += `${n3}: ${e3[n3]};`);
      return t3;
    })(l2);
    e2.setStyle(o2), x$4.set(o2, l2);
  }
  function B$2(t2, n2) {
    const l2 = t2.getNodes(), o2 = l2.length, r2 = t2.getStartEndPoints();
    if (null === r2) return;
    const [s2, f2] = r2, u2 = o2 - 1;
    let g2 = l2[0], a2 = l2[u2];
    if (t2.isCollapsed() && yi(t2)) return void O$3(t2, n2);
    const d2 = g2.getTextContent().length, p2 = f2.offset;
    let h2 = s2.offset;
    const y2 = s2.isBefore(f2);
    let m2 = y2 ? h2 : p2, T2 = y2 ? p2 : h2;
    const x2 = y2 ? s2.type : f2.type, S2 = y2 ? f2.type : s2.type, v2 = y2 ? f2.key : s2.key;
    if (oi(g2) && m2 === d2) {
      const t3 = g2.getNextSibling();
      oi(t3) && (h2 = 0, m2 = 0, g2 = t3);
    }
    if (1 === l2.length) {
      if (oi(g2) && g2.canHaveFormat()) {
        if (m2 = "element" === x2 ? 0 : h2 > p2 ? p2 : h2, T2 = "element" === S2 ? d2 : h2 > p2 ? h2 : p2, m2 === T2) return;
        if (fe(g2) || 0 === m2 && T2 === d2) O$3(g2, n2), g2.select(m2, T2);
        else {
          const e2 = g2.splitText(m2, T2), t3 = 0 === m2 ? e2[0] : e2[1];
          O$3(t3, n2), t3.select(0, T2 - m2);
        }
      }
    } else {
      if (oi(g2) && m2 < g2.getTextContentSize() && g2.canHaveFormat() && (0 === m2 || fe(g2) || (g2 = g2.splitText(m2)[1], m2 = 0, y2 ? s2.set(g2.getKey(), m2, "text") : f2.set(g2.getKey(), m2, "text")), O$3(g2, n2)), oi(a2) && a2.canHaveFormat()) {
        const e2 = a2.getTextContent().length;
        a2.__key !== v2 && 0 !== T2 && (T2 = e2), T2 === e2 || fe(a2) || ([a2] = a2.splitText(T2)), 0 === T2 && "element" !== S2 || O$3(a2, n2);
      }
      for (let t3 = 1; t3 < u2; t3++) {
        const o3 = l2[t3], r3 = o3.getKey();
        oi(o3) && o3.canHaveFormat() && r3 !== g2.getKey() && r3 !== a2.getKey() && !o3.isToken() && O$3(o3, n2);
      }
    }
  }
  function k$3(e2, t2) {
    if (null === e2) return;
    const l2 = e2.getStartEndPoints(), o2 = l2 ? l2[0] : null;
    if (null !== o2 && "root" === o2.key) {
      const e3 = t2(), n2 = we(), l3 = n2.getFirstChild();
      return void (l3 ? l3.replace(e3, true) : n2.append(e3));
    }
    const r2 = e2.getNodes(), s2 = null !== o2 && (function(e3, t3) {
      let n2 = e3;
      for (; null !== n2 && null !== n2.getParent() && !t3(n2); ) n2 = n2.getParentOrThrow();
      return t3(n2) ? n2 : null;
    })(o2.getNode(), U$3);
    s2 && -1 === r2.indexOf(s2) && r2.push(s2);
    for (let e3 = 0; e3 < r2.length; e3++) {
      const l3 = r2[e3];
      if (!U$3(l3)) continue;
      _s(l3) || T$2(178);
      const o3 = t2();
      o3.setFormat(l3.getFormatType()), o3.setIndent(l3.getIndent()), l3.replace(o3, true);
    }
  }
  function A$3(e2, t2) {
    const l2 = Xe(e2.focus, t2);
    return ms(l2) && !l2.isIsolated() || _s(l2) && !l2.isInline() && !l2.canBeEmpty();
  }
  function L$3(e2, t2, n2, l2) {
    e2.modify(t2 ? "extend" : "move", n2, l2);
  }
  function D$3(e2) {
    const t2 = e2.anchor.getNode();
    return "rtl" === (vs(t2) ? t2 : t2.getParentOrThrow()).getDirection();
  }
  function M$4(e2, t2, n2) {
    const l2 = D$3(e2);
    L$3(e2, t2, n2 ? !l2 : l2, "character");
  }
  function U$3(t2) {
    if (ms(t2)) return false;
    if (!_s(t2) || an(t2)) return false;
    const l2 = t2.getFirstChild(), o2 = null === l2 || $r(l2) || oi(l2) || l2.isInline();
    return !t2.isInline() && false !== t2.canBeEmpty() && o2;
  }
  function g$5(e2) {
    return e2 && e2.__esModule && Object.prototype.hasOwnProperty.call(e2, "default") ? e2.default : e2;
  }
  var p$6 = g$5((function(e2) {
    const t2 = new URLSearchParams();
    t2.append("code", e2);
    for (let e3 = 1; e3 < arguments.length; e3++) t2.append("v", arguments[e3]);
    throw Error(`Minified Lexical error #${e2}; visit https://lexical.dev/docs/error?${t2} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }));
  const h$4 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement, m$5 = h$4 && "documentMode" in document ? document.documentMode : null;
  !(!h$4 || !("InputEvent" in window) || m$5) && "getTargetRanges" in new window.InputEvent("input");
  function L$2(...e2) {
    const t2 = [];
    for (const n2 of e2) if (n2 && "string" == typeof n2) for (const [e3] of n2.matchAll(/\S+/g)) t2.push(e3);
    return t2;
  }
  function b$3(...e2) {
    return () => {
      for (let t2 = e2.length - 1; t2 >= 0; t2--) e2[t2]();
      e2.length = 0;
    };
  }
  function $$1(e2, ...t2) {
    const n2 = L$2(...t2);
    n2.length > 0 && e2.classList.add(...n2);
  }
  function U$2(e2, ...t2) {
    const n2 = L$2(...t2);
    n2.length > 0 && e2.classList.remove(...n2);
  }
  function G$2(e2, t2) {
    let n2 = e2;
    for (; null != n2; ) {
      if (n2 instanceof t2) return n2;
      n2 = n2.getParent();
    }
    return null;
  }
  function J$3(e2) {
    const t2 = Q(e2, ((e3) => _s(e3) && !e3.isInline()));
    return _s(t2) || p$6(4, e2.__key), t2;
  }
  const Q = (e2, t2) => {
    let n2 = e2;
    for (; n2 !== we() && null != n2; ) {
      if (t2(n2)) return n2;
      n2 = n2.getParent();
    }
    return null;
  };
  function te(e2, t2) {
    return null !== e2 && Object.getPrototypeOf(e2).constructor.name === t2.name;
  }
  function w$3(t2) {
    return t2 && t2.__esModule && Object.prototype.hasOwnProperty.call(t2, "default") ? t2.default : t2;
  }
  w$3((function(t2) {
    const e2 = new URLSearchParams();
    e2.append("code", t2);
    for (let t3 = 1; t3 < arguments.length; t3++) e2.append("v", arguments[t3]);
    throw Error(`Minified Lexical error #${t2}; visit https://lexical.dev/docs/error?${e2} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }));
  const k$2 = (t2) => {
    try {
      return !!t2 && window.Prism.languages.hasOwnProperty(t2);
    } catch (t3) {
      return false;
    }
  };
  function L$1(e2, n2) {
    for (const r2 of e2.childNodes) {
      if (vn(r2) && r2.tagName === n2) return true;
      L$1(r2, n2);
    }
    return false;
  }
  const A$2 = "data-language", O$2 = "data-highlight-language";
  let M$3 = class M2 extends gs {
    static getType() {
      return "code";
    }
    static clone(t2) {
      return new M2(t2.__language, t2.__key);
    }
    constructor(t2, e2) {
      super(e2), this.__language = t2, this.__isSyntaxHighlightSupported = k$2(t2);
    }
    createDOM(t2) {
      const n2 = document.createElement("code");
      $$1(n2, t2.theme.code), n2.setAttribute("spellcheck", "false");
      const r2 = this.getLanguage();
      return r2 && (n2.setAttribute(A$2, r2), this.getIsSyntaxHighlightSupported() && n2.setAttribute(O$2, r2)), n2;
    }
    updateDOM(t2, e2, n2) {
      const r2 = this.__language, o2 = t2.__language;
      return r2 ? r2 !== o2 && (e2.setAttribute(A$2, r2), this.__isSyntaxHighlightSupported && e2.setAttribute(O$2, r2)) : o2 && (e2.removeAttribute(A$2), t2.__isSyntaxHighlightSupported && e2.removeAttribute(O$2)), false;
    }
    exportDOM(t2) {
      const n2 = document.createElement("pre");
      $$1(n2, t2._config.theme.code), n2.setAttribute("spellcheck", "false");
      const r2 = this.getLanguage();
      return r2 && (n2.setAttribute(A$2, r2), this.getIsSyntaxHighlightSupported() && n2.setAttribute(O$2, r2)), { element: n2 };
    }
    static importDOM() {
      return { code: (t2) => null != t2.textContent && (/\r?\n/.test(t2.textContent) || L$1(t2, "BR")) ? { conversion: z$1, priority: 1 } : null, div: () => ({ conversion: E$4, priority: 1 }), pre: () => ({ conversion: z$1, priority: 0 }), table: (t2) => R$2(t2) ? { conversion: B$1, priority: 3 } : null, td: (t2) => {
        const e2 = t2, n2 = e2.closest("table");
        return e2.classList.contains("js-file-line") || n2 && R$2(n2) ? { conversion: I$1, priority: 3 } : null;
      }, tr: (t2) => {
        const e2 = t2.closest("table");
        return e2 && R$2(e2) ? { conversion: I$1, priority: 3 } : null;
      } };
    }
    static importJSON(t2) {
      const e2 = H(t2.language);
      return e2.setFormat(t2.format), e2.setIndent(t2.indent), e2.setDirection(t2.direction), e2;
    }
    exportJSON() {
      return __spreadProps(__spreadValues({}, super.exportJSON()), { language: this.getLanguage(), type: "code", version: 1 });
    }
    insertNewAfter(t2, e2 = true) {
      const n2 = this.getChildren(), r2 = n2.length;
      if (r2 >= 2 && "\n" === n2[r2 - 1].getTextContent() && "\n" === n2[r2 - 2].getTextContent() && t2.isCollapsed() && t2.anchor.key === this.__key && t2.anchor.offset === r2) {
        n2[r2 - 1].remove(), n2[r2 - 2].remove();
        const t3 = Ns();
        return this.insertAfter(t3, e2), t3;
      }
      const { anchor: o2, focus: a2 } = t2, g2 = (o2.isBefore(a2) ? o2 : a2).getNode();
      if (oi(g2)) {
        let t3 = Z(g2);
        const e3 = [];
        for (; ; ) if (ui(t3)) e3.push(ai()), t3 = t3.getNextSibling();
        else {
          if (!Y(t3)) break;
          {
            let n4 = 0;
            const r4 = t3.getTextContent(), o3 = t3.getTextContentSize();
            for (; n4 < o3 && " " === r4[n4]; ) n4++;
            if (0 !== n4 && e3.push(V$1(" ".repeat(n4))), n4 !== o3) break;
            t3 = t3.getNextSibling();
          }
        }
        const n3 = g2.splitText(o2.offset)[0], r3 = 0 === o2.offset ? 0 : 1, i2 = n3.getIndexWithinParent() + r3, s2 = g2.getParentOrThrow(), a3 = [Kr(), ...e3];
        s2.splice(i2, 0, a3);
        const f2 = e3[e3.length - 1];
        f2 ? f2.select() : 0 === o2.offset ? n3.selectPrevious() : n3.getNextSibling().selectNext(0, 0);
      }
      if (D$2(g2)) {
        const { offset: e3 } = t2.anchor;
        g2.splice(e3, 0, [Kr()]), g2.select(e3 + 1, e3 + 1);
      }
      return null;
    }
    canIndent() {
      return false;
    }
    collapseAtStart() {
      const t2 = Ns();
      return this.getChildren().forEach(((e2) => t2.append(e2))), this.replace(t2), true;
    }
    setLanguage(t2) {
      const e2 = this.getWritable();
      e2.__language = t2, e2.__isSyntaxHighlightSupported = k$2(t2);
    }
    getLanguage() {
      return this.getLatest().__language;
    }
    getIsSyntaxHighlightSupported() {
      return this.getLatest().__isSyntaxHighlightSupported;
    }
  };
  function H(t2) {
    return fn(new M$3(t2));
  }
  function D$2(t2) {
    return t2 instanceof M$3;
  }
  function z$1(t2) {
    return { node: H(t2.getAttribute(A$2)) };
  }
  function E$4(t2) {
    const e2 = t2, n2 = J$2(e2);
    return n2 || (function(t3) {
      let e3 = t3.parentElement;
      for (; null !== e3; ) {
        if (J$2(e3)) return true;
        e3 = e3.parentElement;
      }
      return false;
    })(e2) ? { node: n2 ? H() : null } : { node: null };
  }
  function B$1() {
    return { node: H() };
  }
  function I$1() {
    return { node: null };
  }
  function J$2(t2) {
    return null !== t2.style.fontFamily.match("monospace");
  }
  function R$2(t2) {
    return t2.classList.contains("js-file-line-container");
  }
  class X extends Xr {
    constructor(t2, e2, n2) {
      super(t2, n2), this.__highlightType = e2;
    }
    static getType() {
      return "code-highlight";
    }
    static clone(t2) {
      return new X(t2.__text, t2.__highlightType || void 0, t2.__key);
    }
    getHighlightType() {
      return this.getLatest().__highlightType;
    }
    canHaveFormat() {
      return false;
    }
    createDOM(t2) {
      const n2 = super.createDOM(t2), r2 = G$1(t2.theme, this.__highlightType);
      return $$1(n2, r2), n2;
    }
    updateDOM(t2, r2, o2) {
      const i2 = super.updateDOM(t2, r2, o2), s2 = G$1(o2.theme, t2.__highlightType), l2 = G$1(o2.theme, this.__highlightType);
      return s2 !== l2 && (s2 && U$2(r2, s2), l2 && $$1(r2, l2)), i2;
    }
    static importJSON(t2) {
      const e2 = V$1(t2.text, t2.highlightType);
      return e2.setFormat(t2.format), e2.setDetail(t2.detail), e2.setMode(t2.mode), e2.setStyle(t2.style), e2;
    }
    exportJSON() {
      return __spreadProps(__spreadValues({}, super.exportJSON()), { highlightType: this.getHighlightType(), type: "code-highlight", version: 1 });
    }
    setFormat(t2) {
      return this;
    }
    isParentRequired() {
      return true;
    }
    createParentElementNode() {
      return H();
    }
  }
  function G$1(t2, e2) {
    return e2 && t2 && t2.codeHighlight && t2.codeHighlight[e2];
  }
  function V$1(t2, e2) {
    return fn(new X(t2, e2));
  }
  function Y(t2) {
    return t2 instanceof X;
  }
  function Z(t2) {
    let e2 = t2, n2 = t2;
    for (; Y(n2) || ui(n2); ) e2 = n2, n2 = n2.getPreviousSibling();
    return e2;
  }
  const _$2 = /* @__PURE__ */ new Set(["http:", "https:", "mailto:", "sms:", "tel:"]);
  let o$4 = class o2 extends gs {
    static getType() {
      return "link";
    }
    static clone(t2) {
      return new o2(t2.__url, { rel: t2.__rel, target: t2.__target, title: t2.__title }, t2.__key);
    }
    constructor(t2, e2 = {}, r2) {
      super(r2);
      const { target: i2 = null, rel: n2 = null, title: l2 = null } = e2;
      this.__url = t2, this.__target = i2, this.__rel = n2, this.__title = l2;
    }
    createDOM(e2) {
      const r2 = document.createElement("a");
      return r2.href = this.sanitizeUrl(this.__url), null !== this.__target && (r2.target = this.__target), null !== this.__rel && (r2.rel = this.__rel), null !== this.__title && (r2.title = this.__title), $$1(r2, e2.theme.link), r2;
    }
    updateDOM(t2, e2, r2) {
      if (e2 instanceof HTMLAnchorElement) {
        const r3 = this.__url, i2 = this.__target, n2 = this.__rel, l2 = this.__title;
        r3 !== t2.__url && (e2.href = r3), i2 !== t2.__target && (i2 ? e2.target = i2 : e2.removeAttribute("target")), n2 !== t2.__rel && (n2 ? e2.rel = n2 : e2.removeAttribute("rel")), l2 !== t2.__title && (l2 ? e2.title = l2 : e2.removeAttribute("title"));
      }
      return false;
    }
    static importDOM() {
      return { a: (t2) => ({ conversion: a$3, priority: 1 }) };
    }
    static importJSON(t2) {
      const e2 = h$3(t2.url, { rel: t2.rel, target: t2.target, title: t2.title });
      return e2.setFormat(t2.format), e2.setIndent(t2.indent), e2.setDirection(t2.direction), e2;
    }
    sanitizeUrl(t2) {
      try {
        const e2 = new URL(t2);
        if (!_$2.has(e2.protocol)) return "about:blank";
      } catch (e2) {
        return t2;
      }
      return t2;
    }
    exportJSON() {
      return __spreadProps(__spreadValues({}, super.exportJSON()), { rel: this.getRel(), target: this.getTarget(), title: this.getTitle(), type: "link", url: this.getURL(), version: 1 });
    }
    getURL() {
      return this.getLatest().__url;
    }
    setURL(t2) {
      this.getWritable().__url = t2;
    }
    getTarget() {
      return this.getLatest().__target;
    }
    setTarget(t2) {
      this.getWritable().__target = t2;
    }
    getRel() {
      return this.getLatest().__rel;
    }
    setRel(t2) {
      this.getWritable().__rel = t2;
    }
    getTitle() {
      return this.getLatest().__title;
    }
    setTitle(t2) {
      this.getWritable().__title = t2;
    }
    insertNewAfter(t2, e2 = true) {
      const r2 = h$3(this.__url, { rel: this.__rel, target: this.__target, title: this.__title });
      return this.insertAfter(r2, e2), r2;
    }
    canInsertTextBefore() {
      return false;
    }
    canInsertTextAfter() {
      return false;
    }
    canBeEmpty() {
      return false;
    }
    isInline() {
      return true;
    }
    extractWithChild(t2, e2, r2) {
      if (!yi(e2)) return false;
      const i2 = e2.anchor.getNode(), l2 = e2.focus.getNode();
      return this.isParentOf(i2) && this.isParentOf(l2) && e2.getTextContent().length > 0;
    }
    isEmailURI() {
      return this.__url.startsWith("mailto:");
    }
    isWebSiteURI() {
      return this.__url.startsWith("https://") || this.__url.startsWith("http://");
    }
  };
  function a$3(t2) {
    let r2 = null;
    if (xn(t2)) {
      const e2 = t2.textContent;
      (null !== e2 && "" !== e2 || t2.children.length > 0) && (r2 = h$3(t2.getAttribute("href") || "", { rel: t2.getAttribute("rel"), target: t2.getAttribute("target"), title: t2.getAttribute("title") }));
    }
    return { node: r2 };
  }
  function h$3(t2, e2) {
    return fn(new o$4(t2, e2));
  }
  function c$2(t2) {
    return t2 instanceof o$4;
  }
  let g$4 = class g2 extends o$4 {
    constructor(t2, e2 = {}, r2) {
      super(t2, e2, r2), this.__isUnlinked = void 0 !== e2.isUnlinked && null !== e2.isUnlinked && e2.isUnlinked;
    }
    static getType() {
      return "autolink";
    }
    static clone(t2) {
      return new g2(t2.__url, { isUnlinked: t2.__isUnlinked, rel: t2.__rel, target: t2.__target, title: t2.__title }, t2.__key);
    }
    getIsUnlinked() {
      return this.__isUnlinked;
    }
    setIsUnlinked(t2) {
      const e2 = this.getWritable();
      return e2.__isUnlinked = t2, e2;
    }
    createDOM(t2) {
      return this.__isUnlinked ? document.createElement("span") : super.createDOM(t2);
    }
    updateDOM(t2, e2, r2) {
      return super.updateDOM(t2, e2, r2) || t2.__isUnlinked !== this.__isUnlinked;
    }
    static importJSON(t2) {
      const e2 = f$2(t2.url, { isUnlinked: t2.isUnlinked, rel: t2.rel, target: t2.target, title: t2.title });
      return e2.setFormat(t2.format), e2.setIndent(t2.indent), e2.setDirection(t2.direction), e2;
    }
    static importDOM() {
      return null;
    }
    exportJSON() {
      return __spreadProps(__spreadValues({}, super.exportJSON()), { isUnlinked: this.__isUnlinked, type: "autolink", version: 1 });
    }
    insertNewAfter(t2, e2 = true) {
      const r2 = this.getParentOrThrow().insertNewAfter(t2, e2);
      if (_s(r2)) {
        const t3 = f$2(this.__url, { isUnlinked: this.__isUnlinked, rel: this.__rel, target: this.__target, title: this.__title });
        return r2.append(t3), t3;
      }
      return null;
    }
  };
  function f$2(t2, e2) {
    return fn(new g$4(t2, e2));
  }
  function d$2(t2) {
    return t2 instanceof g$4;
  }
  const p$5 = t$2();
  function U$1(t2, e2 = {}) {
    const { target: r2, title: i2 } = e2, l2 = void 0 === e2.rel ? "noreferrer" : e2.rel, _2 = Oi();
    if (!yi(_2)) return;
    const o2 = _2.extract();
    if (null === t2) o2.forEach(((t3) => {
      const e3 = t3.getParent();
      if (!d$2(e3) && c$2(e3)) {
        const t4 = e3.getChildren();
        for (let r3 = 0; r3 < t4.length; r3++) e3.insertBefore(t4[r3]);
        e3.remove();
      }
    }));
    else {
      if (1 === o2.length) {
        const e4 = (function(t3, e5) {
          let r3 = t3;
          for (; null !== r3 && null !== r3.getParent() && !e5(r3); ) r3 = r3.getParentOrThrow();
          return e5(r3) ? r3 : null;
        })(o2[0], c$2);
        if (null !== e4) return e4.setURL(t2), void 0 !== r2 && e4.setTarget(r2), null !== l2 && e4.setRel(l2), void (void 0 !== i2 && e4.setTitle(i2));
      }
      let e3 = null, n2 = null;
      o2.forEach(((u2) => {
        const _3 = u2.getParent();
        if (_3 !== n2 && null !== _3 && (!_s(u2) || u2.isInline())) {
          if (c$2(_3)) return n2 = _3, _3.setURL(t2), void 0 !== r2 && _3.setTarget(r2), null !== l2 && n2.setRel(l2), void (void 0 !== i2 && n2.setTitle(i2));
          if (_3.is(e3) || (e3 = _3, n2 = h$3(t2, { rel: l2, target: r2, title: i2 }), c$2(_3) ? null === u2.getPreviousSibling() ? _3.insertBefore(n2) : _3.insertAfter(n2) : u2.insertBefore(n2)), c$2(u2)) {
            if (u2.is(n2)) return;
            if (null !== n2) {
              const t3 = u2.getChildren();
              for (let e4 = 0; e4 < t3.length; e4++) n2.append(t3[e4]);
            }
            u2.remove();
          } else null !== n2 && n2.append(u2);
        }
      }));
    }
  }
  function p$4(e2) {
    return e2 && e2.__esModule && Object.prototype.hasOwnProperty.call(e2, "default") ? e2.default : e2;
  }
  var _$1 = p$4((function(e2) {
    const t2 = new URLSearchParams();
    t2.append("code", e2);
    for (let e3 = 1; e3 < arguments.length; e3++) t2.append("v", arguments[e3]);
    throw Error(`Minified Lexical error #${e2}; visit https://lexical.dev/docs/error?${t2} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }));
  function m$4(e2) {
    let t2 = 1, n2 = e2.getParent();
    for (; null != n2; ) {
      if (B(n2)) {
        const e3 = n2.getParent();
        if ($(e3)) {
          t2++, n2 = e3.getParent();
          continue;
        }
        _$1(40);
      }
      return t2;
    }
    return t2;
  }
  function v$2(e2) {
    let t2 = e2.getParent();
    $(t2) || _$1(40);
    let n2 = t2;
    for (; null !== n2; ) n2 = n2.getParent(), $(n2) && (t2 = n2);
    return t2;
  }
  function y$3(e2) {
    let t2 = [];
    const n2 = e2.getChildren().filter(B);
    for (let e3 = 0; e3 < n2.length; e3++) {
      const r2 = n2[e3], i2 = r2.getFirstChild();
      $(i2) ? t2 = t2.concat(y$3(i2)) : t2.push(r2);
    }
    return t2;
  }
  function C$2(e2) {
    return B(e2) && $(e2.getFirstChild());
  }
  function k$1(e2) {
    return R$1().append(e2);
  }
  function T$1(e2, t2) {
    return B(e2) && (0 === t2.length || 1 === t2.length && e2.is(t2[0]) && 0 === e2.getChildrenSize());
  }
  function b$2(s2, o2) {
    s2.update((() => {
      const s3 = Oi();
      if (null !== s3) {
        const e2 = s3.getNodes();
        if (yi(s3)) {
          const t2 = s3.getStartEndPoints();
          null === t2 && _$1(143);
          const [i2] = t2, c3 = i2.getNode(), l2 = c3.getParent();
          if (T$1(c3, e2)) {
            const e3 = U(o2);
            if (an(l2)) {
              c3.replace(e3);
              const t3 = R$1();
              _s(c3) && (t3.setFormat(c3.getFormatType()), t3.setIndent(c3.getIndent())), e3.append(t3);
            } else if (B(c3)) {
              const t3 = c3.getParentOrThrow();
              S$2(e3, t3.getChildren()), t3.replace(e3);
            }
            return;
          }
        }
        const c2 = /* @__PURE__ */ new Set();
        for (let t2 = 0; t2 < e2.length; t2++) {
          const s4 = e2[t2];
          if (!_s(s4) || !s4.isEmpty() || B(s4) || c2.has(s4.getKey())) {
            if (_e(s4)) {
              let e3 = s4.getParent();
              for (; null != e3; ) {
                const t3 = e3.getKey();
                if ($(e3)) {
                  if (!c2.has(t3)) {
                    const n2 = U(o2);
                    S$2(n2, e3.getChildren()), e3.replace(n2), c2.add(t3);
                  }
                  break;
                }
                {
                  const r2 = e3.getParent();
                  if (an(r2) && !c2.has(t3)) {
                    c2.add(t3), P$1(e3, o2);
                    break;
                  }
                  e3 = r2;
                }
              }
            }
          } else P$1(s4, o2);
        }
      }
    }));
  }
  function S$2(e2, t2) {
    e2.splice(e2.getChildrenSize(), 0, t2);
  }
  function P$1(e2, t2) {
    if ($(e2)) return e2;
    const n2 = e2.getPreviousSibling(), r2 = e2.getNextSibling(), i2 = R$1();
    if (i2.setFormat(e2.getFormatType()), i2.setIndent(e2.getIndent()), S$2(i2, e2.getChildren()), $(n2) && t2 === n2.getListType()) return n2.append(i2), e2.remove(), $(r2) && t2 === r2.getListType() && (S$2(n2, r2.getChildren()), r2.remove()), n2;
    if ($(r2) && t2 === r2.getListType()) return r2.getFirstChildOrThrow().insertBefore(i2), e2.remove(), r2;
    {
      const n3 = U(t2);
      return n3.append(i2), e2.replace(n3), n3;
    }
  }
  function A$1(e2, t2) {
    const n2 = e2.getLastChild(), r2 = t2.getFirstChild();
    n2 && r2 && C$2(n2) && C$2(r2) && (A$1(n2.getFirstChild(), r2.getFirstChild()), r2.remove());
    const i2 = t2.getChildren();
    i2.length > 0 && e2.append(...i2), t2.remove();
  }
  function N$1(n2) {
    n2.update((() => {
      const n3 = Oi();
      if (yi(n3)) {
        const e2 = /* @__PURE__ */ new Set(), t2 = n3.getNodes(), r2 = n3.anchor.getNode();
        if (T$1(r2, t2)) e2.add(v$2(r2));
        else for (let n4 = 0; n4 < t2.length; n4++) {
          const r3 = t2[n4];
          if (_e(r3)) {
            const t3 = G$2(r3, M$2);
            null != t3 && e2.add(v$2(t3));
          }
        }
        for (const t3 of e2) {
          let e3 = t3;
          const r3 = y$3(t3);
          for (const t4 of r3) {
            const r4 = Ns();
            S$2(r4, t4.getChildren()), e3.insertAfter(r4), e3 = r4, t4.__key === n3.anchor.key && n3.anchor.set(r4.getKey(), 0, "element"), t4.__key === n3.focus.key && n3.focus.set(r4.getKey(), 0, "element"), t4.remove();
          }
          t3.remove();
        }
      }
    }));
  }
  function x$3(e2) {
    const t2 = /* @__PURE__ */ new Set();
    if (C$2(e2) || t2.has(e2.getKey())) return;
    const n2 = e2.getParent(), r2 = e2.getNextSibling(), i2 = e2.getPreviousSibling();
    if (C$2(r2) && C$2(i2)) {
      const n3 = i2.getFirstChild();
      if ($(n3)) {
        n3.append(e2);
        const i3 = r2.getFirstChild();
        if ($(i3)) {
          S$2(n3, i3.getChildren()), r2.remove(), t2.add(r2.getKey());
        }
      }
    } else if (C$2(r2)) {
      const t3 = r2.getFirstChild();
      if ($(t3)) {
        const n3 = t3.getFirstChild();
        null !== n3 && n3.insertBefore(e2);
      }
    } else if (C$2(i2)) {
      const t3 = i2.getFirstChild();
      $(t3) && t3.append(e2);
    } else if ($(n2)) {
      const t3 = R$1(), s2 = U(n2.getListType());
      t3.append(s2), s2.append(e2), i2 ? i2.insertAfter(t3) : r2 ? r2.insertBefore(t3) : n2.append(t3);
    }
  }
  function L(e2) {
    if (C$2(e2)) return;
    const t2 = e2.getParent(), n2 = t2 ? t2.getParent() : void 0;
    if ($(n2 ? n2.getParent() : void 0) && B(n2) && $(t2)) {
      const r2 = t2 ? t2.getFirstChild() : void 0, i2 = t2 ? t2.getLastChild() : void 0;
      if (e2.is(r2)) n2.insertBefore(e2), t2.isEmpty() && n2.remove();
      else if (e2.is(i2)) n2.insertAfter(e2), t2.isEmpty() && n2.remove();
      else {
        const r3 = t2.getListType(), i3 = R$1(), s2 = U(r3);
        i3.append(s2), e2.getPreviousSiblings().forEach(((e3) => s2.append(e3)));
        const o2 = R$1(), c2 = U(r3);
        o2.append(c2), S$2(c2, e2.getNextSiblings()), n2.insertBefore(i3), n2.insertAfter(o2), n2.replace(e2);
      }
    }
  }
  function O$1() {
    const r2 = Oi();
    if (!yi(r2) || !r2.isCollapsed()) return false;
    const i2 = r2.anchor.getNode();
    if (!B(i2) || 0 !== i2.getChildrenSize()) return false;
    const c2 = v$2(i2), l2 = i2.getParent();
    $(l2) || _$1(40);
    const a2 = l2.getParent();
    let h2;
    if (an(a2)) h2 = Ns(), c2.insertAfter(h2);
    else {
      if (!B(a2)) return false;
      h2 = R$1(), a2.insertAfter(h2);
    }
    h2.select();
    const u2 = i2.getNextSiblings();
    if (u2.length > 0) {
      const e2 = U(l2.getListType());
      if (Es(h2)) h2.insertAfter(e2);
      else {
        const t2 = R$1();
        t2.append(e2), h2.insertAfter(t2);
      }
      u2.forEach(((t2) => {
        t2.remove(), e2.append(t2);
      }));
    }
    return (function(e2) {
      let t2 = e2;
      for (; null == t2.getNextSibling() && null == t2.getPreviousSibling(); ) {
        const e3 = t2.getParent();
        if (null == e3 || !B(t2) && !$(t2)) break;
        t2 = e3;
      }
      t2.remove();
    })(i2), true;
  }
  function E$3(...e2) {
    const t2 = [];
    for (const n2 of e2) if (n2 && "string" == typeof n2) for (const [e3] of n2.matchAll(/\S+/g)) t2.push(e3);
    return t2;
  }
  let M$2 = class M2 extends gs {
    static getType() {
      return "listitem";
    }
    static clone(e2) {
      return new M2(e2.__value, e2.__checked, e2.__key);
    }
    constructor(e2, t2, n2) {
      super(n2), this.__value = void 0 === e2 ? 1 : e2, this.__checked = t2;
    }
    createDOM(e2) {
      const t2 = document.createElement("li"), n2 = this.getParent();
      return $(n2) && "check" === n2.getListType() && w$2(t2, this, null), t2.value = this.__value, F$1(t2, e2.theme, this), t2;
    }
    updateDOM(e2, t2, n2) {
      const r2 = this.getParent();
      return $(r2) && "check" === r2.getListType() && w$2(t2, this, e2), t2.value = this.__value, F$1(t2, n2.theme, this), false;
    }
    static transform() {
      return (e2) => {
        if (B(e2) || _$1(144), null == e2.__checked) return;
        const t2 = e2.getParent();
        $(t2) && "check" !== t2.getListType() && null != e2.getChecked() && e2.setChecked(void 0);
      };
    }
    static importDOM() {
      return { li: () => ({ conversion: D$1, priority: 0 }) };
    }
    static importJSON(e2) {
      const t2 = R$1();
      return t2.setChecked(e2.checked), t2.setValue(e2.value), t2.setFormat(e2.format), t2.setDirection(e2.direction), t2;
    }
    exportDOM(e2) {
      const t2 = this.createDOM(e2._config);
      return t2.style.textAlign = this.getFormatType(), { element: t2 };
    }
    exportJSON() {
      return __spreadProps(__spreadValues({}, super.exportJSON()), { checked: this.getChecked(), type: "listitem", value: this.getValue(), version: 1 });
    }
    append(...e2) {
      for (let t2 = 0; t2 < e2.length; t2++) {
        const n2 = e2[t2];
        if (_s(n2) && this.canMergeWith(n2)) {
          const e3 = n2.getChildren();
          this.append(...e3), n2.remove();
        } else super.append(n2);
      }
      return this;
    }
    replace(e2, t2) {
      if (B(e2)) return super.replace(e2);
      this.setIndent(0);
      const n2 = this.getParentOrThrow();
      if (!$(n2)) return e2;
      if (n2.__first === this.getKey()) n2.insertBefore(e2);
      else if (n2.__last === this.getKey()) n2.insertAfter(e2);
      else {
        const t3 = U(n2.getListType());
        let r2 = this.getNextSibling();
        for (; r2; ) {
          const e3 = r2;
          r2 = r2.getNextSibling(), t3.append(e3);
        }
        n2.insertAfter(e2), e2.insertAfter(t3);
      }
      return t2 && (_s(e2) || _$1(139), this.getChildren().forEach(((t3) => {
        e2.append(t3);
      }))), this.remove(), 0 === n2.getChildrenSize() && n2.remove(), e2;
    }
    insertAfter(e2, t2 = true) {
      const n2 = this.getParentOrThrow();
      if ($(n2) || _$1(39), B(e2)) return super.insertAfter(e2, t2);
      const r2 = this.getNextSiblings();
      if (n2.insertAfter(e2, t2), 0 !== r2.length) {
        const i2 = U(n2.getListType());
        r2.forEach(((e3) => i2.append(e3))), e2.insertAfter(i2, t2);
      }
      return e2;
    }
    remove(e2) {
      const t2 = this.getPreviousSibling(), n2 = this.getNextSibling();
      super.remove(e2), t2 && n2 && C$2(t2) && C$2(n2) && (A$1(t2.getFirstChild(), n2.getFirstChild()), n2.remove());
    }
    insertNewAfter(e2, t2 = true) {
      const n2 = R$1(null == this.__checked && void 0);
      return this.insertAfter(n2, t2), n2;
    }
    collapseAtStart(e2) {
      const t2 = Ns();
      this.getChildren().forEach(((e3) => t2.append(e3)));
      const n2 = this.getParentOrThrow(), r2 = n2.getParentOrThrow(), i2 = B(r2);
      if (1 === n2.getChildrenSize()) if (i2) n2.remove(), r2.select();
      else {
        n2.insertBefore(t2), n2.remove();
        const r3 = e2.anchor, i3 = e2.focus, s2 = t2.getKey();
        "element" === r3.type && r3.getNode().is(this) && r3.set(s2, r3.offset, "element"), "element" === i3.type && i3.getNode().is(this) && i3.set(s2, i3.offset, "element");
      }
      else n2.insertBefore(t2), this.remove();
      return true;
    }
    getValue() {
      return this.getLatest().__value;
    }
    setValue(e2) {
      this.getWritable().__value = e2;
    }
    getChecked() {
      const e2 = this.getLatest();
      let t2;
      const n2 = this.getParent();
      return $(n2) && (t2 = n2.getListType()), "check" === t2 ? Boolean(e2.__checked) : void 0;
    }
    setChecked(e2) {
      this.getWritable().__checked = e2;
    }
    toggleChecked() {
      this.setChecked(!this.__checked);
    }
    getIndent() {
      const e2 = this.getParent();
      if (null === e2) return this.getLatest().__indent;
      let t2 = e2.getParentOrThrow(), n2 = 0;
      for (; B(t2); ) t2 = t2.getParentOrThrow().getParentOrThrow(), n2++;
      return n2;
    }
    setIndent(e2) {
      "number" != typeof e2 && _$1(117), (e2 = Math.floor(e2)) >= 0 || _$1(199);
      let t2 = this.getIndent();
      for (; t2 !== e2; ) t2 < e2 ? (x$3(this), t2++) : (L(this), t2--);
      return this;
    }
    canInsertAfter(e2) {
      return B(e2);
    }
    canReplaceWith(e2) {
      return B(e2);
    }
    canMergeWith(e2) {
      return Es(e2) || B(e2);
    }
    extractWithChild(e2, n2) {
      if (!yi(n2)) return false;
      const r2 = n2.anchor.getNode(), i2 = n2.focus.getNode();
      return this.isParentOf(r2) && this.isParentOf(i2) && this.getTextContent().length === n2.getTextContent().length;
    }
    isParentRequired() {
      return true;
    }
    createParentElementNode() {
      return U("bullet");
    }
    canMergeWhenEmpty() {
      return true;
    }
  };
  function F$1(e2, t2, n2) {
    const r2 = [], i2 = [], s2 = t2.list, o2 = s2 ? s2.listitem : void 0;
    let c2;
    if (s2 && s2.nested && (c2 = s2.nested.listitem), void 0 !== o2 && r2.push(...E$3(o2)), s2) {
      const e3 = n2.getParent(), t3 = $(e3) && "check" === e3.getListType(), o3 = n2.getChecked();
      t3 && !o3 || i2.push(s2.listitemUnchecked), t3 && o3 || i2.push(s2.listitemChecked), t3 && r2.push(o3 ? s2.listitemChecked : s2.listitemUnchecked);
    }
    if (void 0 !== c2) {
      const e3 = E$3(c2);
      n2.getChildren().some(((e4) => $(e4))) ? r2.push(...e3) : i2.push(...e3);
    }
    i2.length > 0 && U$2(e2, ...i2), r2.length > 0 && $$1(e2, ...r2);
  }
  function w$2(e2, t2, n2, r2) {
    $(t2.getFirstChild()) ? (e2.removeAttribute("role"), e2.removeAttribute("tabIndex"), e2.removeAttribute("aria-checked")) : (e2.setAttribute("role", "checkbox"), e2.setAttribute("tabIndex", "-1"), n2 && t2.__checked === n2.__checked || e2.setAttribute("aria-checked", t2.getChecked() ? "true" : "false"));
  }
  function D$1(e2) {
    if (e2.classList.contains("task-list-item")) {
      for (const t3 of e2.children) if ("INPUT" === t3.tagName) return I(t3);
    }
    const t2 = e2.getAttribute("aria-checked");
    return { node: R$1("true" === t2 || "false" !== t2 && void 0) };
  }
  function I(e2) {
    if (!("checkbox" === e2.getAttribute("type"))) return { node: null };
    return { node: R$1(e2.hasAttribute("checked")) };
  }
  function R$1(e2) {
    return fn(new M$2(void 0, e2));
  }
  function B(e2) {
    return e2 instanceof M$2;
  }
  class K extends gs {
    static getType() {
      return "list";
    }
    static clone(e2) {
      const t2 = e2.__listType || z[e2.__tag];
      return new K(t2, e2.__start, e2.__key);
    }
    constructor(e2, t2, n2) {
      super(n2);
      const r2 = z[e2] || e2;
      this.__listType = r2, this.__tag = "number" === r2 ? "ol" : "ul", this.__start = t2;
    }
    getTag() {
      return this.__tag;
    }
    setListType(e2) {
      const t2 = this.getWritable();
      t2.__listType = e2, t2.__tag = "number" === e2 ? "ol" : "ul";
    }
    getListType() {
      return this.__listType;
    }
    getStart() {
      return this.__start;
    }
    createDOM(e2, t2) {
      const n2 = this.__tag, r2 = document.createElement(n2);
      return 1 !== this.__start && r2.setAttribute("start", String(this.__start)), r2.__lexicalListType = this.__listType, W(r2, e2.theme, this), r2;
    }
    updateDOM(e2, t2, n2) {
      return e2.__tag !== this.__tag || (W(t2, n2.theme, this), false);
    }
    static transform() {
      return (e2) => {
        $(e2) || _$1(163), (function(e3) {
          const t2 = e3.getNextSibling();
          $(t2) && e3.getListType() === t2.getListType() && A$1(e3, t2);
        })(e2), (function(e3) {
          const t2 = "check" !== e3.getListType();
          let n2 = e3.getStart();
          for (const r2 of e3.getChildren()) B(r2) && (r2.getValue() !== n2 && r2.setValue(n2), t2 && null != r2.getLatest().__checked && r2.setChecked(void 0), $(r2.getFirstChild()) || n2++);
        })(e2);
      };
    }
    static importDOM() {
      return { ol: () => ({ conversion: J$1, priority: 0 }), ul: () => ({ conversion: J$1, priority: 0 }) };
    }
    static importJSON(e2) {
      const t2 = U(e2.listType, e2.start);
      return t2.setFormat(e2.format), t2.setIndent(e2.indent), t2.setDirection(e2.direction), t2;
    }
    exportDOM(e2) {
      const { element: t2 } = super.exportDOM(e2);
      return t2 && vn(t2) && (1 !== this.__start && t2.setAttribute("start", String(this.__start)), "check" === this.__listType && t2.setAttribute("__lexicalListType", "check")), { element: t2 };
    }
    exportJSON() {
      return __spreadProps(__spreadValues({}, super.exportJSON()), { listType: this.getListType(), start: this.getStart(), tag: this.getTag(), type: "list", version: 1 });
    }
    canBeEmpty() {
      return false;
    }
    canIndent() {
      return false;
    }
    append(...e2) {
      for (let t2 = 0; t2 < e2.length; t2++) {
        const n2 = e2[t2];
        if (B(n2)) super.append(n2);
        else {
          const e3 = R$1();
          if ($(n2)) e3.append(n2);
          else if (_s(n2)) {
            const t3 = si(n2.getTextContent());
            e3.append(t3);
          } else e3.append(n2);
          super.append(e3);
        }
      }
      return this;
    }
    extractWithChild(e2) {
      return B(e2);
    }
  }
  function W(e2, t2, n2) {
    const r2 = [], i2 = [], s2 = t2.list;
    if (void 0 !== s2) {
      const e3 = s2[`${n2.__tag}Depth`] || [], t3 = m$4(n2) - 1, o2 = t3 % e3.length, c2 = e3[o2], l2 = s2[n2.__tag];
      let a2;
      const h2 = s2.nested, u2 = s2.checklist;
      if (void 0 !== h2 && h2.list && (a2 = h2.list), void 0 !== l2 && r2.push(l2), void 0 !== u2 && "check" === n2.__listType && r2.push(u2), void 0 !== c2) {
        r2.push(...E$3(c2));
        for (let t4 = 0; t4 < e3.length; t4++) t4 !== o2 && i2.push(n2.__tag + t4);
      }
      if (void 0 !== a2) {
        const e4 = E$3(a2);
        t3 > 1 ? r2.push(...e4) : i2.push(...e4);
      }
    }
    i2.length > 0 && U$2(e2, ...i2), r2.length > 0 && $$1(e2, ...r2);
  }
  function V(e2) {
    const t2 = [];
    for (let n2 = 0; n2 < e2.length; n2++) {
      const r2 = e2[n2];
      if (B(r2)) {
        t2.push(r2);
        const e3 = r2.getChildren();
        e3.length > 1 && e3.forEach(((e4) => {
          $(e4) && t2.push(k$1(e4));
        }));
      } else t2.push(k$1(r2));
    }
    return t2;
  }
  function J$1(e2) {
    const t2 = e2.nodeName.toLowerCase();
    let n2 = null;
    if ("ol" === t2) {
      n2 = U("number", e2.start);
    } else "ul" === t2 && (n2 = (function(e3) {
      if ("check" === e3.getAttribute("__lexicallisttype") || e3.classList.contains("contains-task-list")) return true;
      for (const t3 of e3.childNodes) if (vn(t3) && t3.hasAttribute("aria-checked")) return true;
      return false;
    })(e2) ? U("check") : U("bullet"));
    return { after: V, node: n2 };
  }
  const z = { ol: "number", ul: "bullet" };
  function U(e2, t2 = 1) {
    return fn(new K(e2, t2));
  }
  function $(e2) {
    return e2 instanceof K;
  }
  const j = t$2(), q = t$2(), G = t$2();
  function r$1(e2) {
    return e2 && e2.__esModule && Object.prototype.hasOwnProperty.call(e2, "default") ? e2.default : e2;
  }
  var t$1 = r$1((function(e2) {
    const n2 = new URLSearchParams();
    n2.append("code", e2);
    for (let e3 = 1; e3 < arguments.length; e3++) n2.append("v", arguments[e3]);
    throw Error(`Minified Lexical error #${e2}; visit https://lexical.dev/docs/error?${n2} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }));
  const l$1 = reactExports.createContext(null);
  function o$3(e2, n2) {
    return { getTheme: function() {
      return null != n2 ? n2 : null;
    } };
  }
  function u$6() {
    const e2 = reactExports.useContext(l$1);
    return null == e2 && t$1(8), e2;
  }
  function u$5() {
    const [u2] = u$6();
    return reactExports.useEffect((() => {
      if (!u2.hasNodes([K, M$2])) throw new Error("ListPlugin: ListNode and/or ListItemNode not registered on editor");
    }), [u2]), (function(n2) {
      reactExports.useEffect((() => b$3(n2.registerCommand(q, (() => (b$2(n2, "number"), true)), Fs), n2.registerCommand(j, (() => (b$2(n2, "bullet"), true)), Fs), n2.registerCommand(G, (() => (N$1(n2), true)), Fs), n2.registerCommand(o$5, (() => !!O$1()), Fs))), [n2]);
    })(u2), null;
  }
  function p$3(e2, n2) {
    const t2 = n2.body ? n2.body.childNodes : [];
    let o2 = [];
    const l2 = [];
    for (let n3 = 0; n3 < t2.length; n3++) {
      const r2 = t2[n3];
      if (!g$3.has(r2.nodeName)) {
        const n4 = x$2(r2, e2, l2, false);
        null !== n4 && (o2 = o2.concat(n4));
      }
    }
    return (function(e3) {
      for (const n3 of e3) n3.getNextSibling() instanceof ks && n3.insertAfter(Kr());
      for (const n3 of e3) {
        const e4 = n3.getChildren();
        for (const t3 of e4) n3.insertBefore(t3);
        n3.remove();
      }
    })(l2), o2;
  }
  function h$2(e2, n2) {
    if ("undefined" == typeof document || "undefined" == typeof window && void 0 === global.window) throw new Error("To use $generateHtmlFromNodes in headless mode please initialize a headless browser implementation such as JSDom before calling this function.");
    const t2 = document.createElement("div"), l2 = we().getChildren();
    for (let o2 = 0; o2 < l2.length; o2++) {
      m$3(e2, l2[o2], t2, n2);
    }
    return t2.innerHTML;
  }
  function m$3(t2, o2, s2, c2 = null) {
    let u2 = null === c2 || o2.isSelected(c2);
    const f2 = _s(o2) && o2.excludeFromCopy("html");
    let a2 = o2;
    if (null !== c2) {
      let n2 = Pn(o2);
      n2 = oi(n2) && null !== c2 ? E$5(c2, n2) : n2, a2 = n2;
    }
    const d2 = _s(a2) ? a2.getChildren() : [], p2 = t2._nodes.get(a2.getType());
    let h2;
    h2 = p2 && void 0 !== p2.exportDOM ? p2.exportDOM(t2, a2) : a2.exportDOM(t2);
    const { element: g2, after: x2 } = h2;
    if (!g2) return false;
    const y2 = document.createDocumentFragment();
    for (let e2 = 0; e2 < d2.length; e2++) {
      const n2 = d2[e2], r2 = m$3(t2, n2, y2, c2);
      !u2 && _s(o2) && r2 && o2.extractWithChild(n2, c2, "html") && (u2 = true);
    }
    if (u2 && !f2) {
      if (vn(g2) && g2.append(y2), s2.append(g2), x2) {
        const e2 = x2.call(a2, g2);
        e2 && g2.replaceWith(e2);
      }
    } else s2.append(y2);
    return u2;
  }
  const g$3 = /* @__PURE__ */ new Set(["STYLE", "SCRIPT"]);
  function x$2(e2, n2, o2, r2, i2 = /* @__PURE__ */ new Map(), p2) {
    let h2 = [];
    if (g$3.has(e2.nodeName)) return h2;
    let m2 = null;
    const w2 = (function(e3, n3) {
      const { nodeName: t2 } = e3, o3 = n3._htmlConversions.get(t2.toLowerCase());
      let l2 = null;
      if (void 0 !== o3) for (const n4 of o3) {
        const t3 = n4(e3);
        null !== t3 && (null === l2 || (l2.priority || 0) < (t3.priority || 0)) && (l2 = t3);
      }
      return null !== l2 ? l2.conversion : null;
    })(e2, n2), b2 = w2 ? w2(e2) : null;
    let C2 = null;
    if (null !== b2) {
      C2 = b2.after;
      const n3 = b2.node;
      if (m2 = Array.isArray(n3) ? n3[n3.length - 1] : n3, null !== m2) {
        for (const [, e3] of i2) if (m2 = e3(m2, p2), !m2) break;
        m2 && h2.push(...Array.isArray(n3) ? n3 : [m2]);
      }
      null != b2.forChild && i2.set(e2.nodeName, b2.forChild);
    }
    const S2 = e2.childNodes;
    let v2 = [];
    const N2 = (null == m2 || !an(m2)) && (null != m2 && Ni(m2) || r2);
    for (let e3 = 0; e3 < S2.length; e3++) v2.push(...x$2(S2[e3], n2, o2, N2, new Map(i2), m2));
    return null != C2 && (v2 = C2(v2)), Tn(e2) && (v2 = y$2(e2, v2, N2 ? () => {
      const e3 = new ks();
      return o2.push(e3), e3;
    } : Ns)), null == m2 ? v2.length > 0 ? h2 = h2.concat(v2) : Tn(e2) && (function(e3) {
      if (null == e3.nextSibling || null == e3.previousSibling) return false;
      return Sn(e3.nextSibling) && Sn(e3.previousSibling);
    })(e2) && (h2 = h2.concat(Kr())) : _s(m2) && m2.append(...v2), h2;
  }
  function y$2(e2, n2, t2) {
    const o2 = e2.style.textAlign, l2 = [];
    let r2 = [];
    for (let e3 = 0; e3 < n2.length; e3++) {
      const i2 = n2[e3];
      if (Ni(i2)) o2 && !i2.getFormat() && i2.setFormat(o2), l2.push(i2);
      else if (r2.push(i2), e3 === n2.length - 1 || e3 < n2.length - 1 && Ni(n2[e3 + 1])) {
        const e4 = t2();
        e4.setFormat(o2), e4.append(...r2), l2.push(e4), r2 = [];
      }
    }
    return l2;
  }
  function w$1(t2) {
    return t2 && t2.__esModule && Object.prototype.hasOwnProperty.call(t2, "default") ? t2.default : t2;
  }
  var y$1 = w$1((function(t2) {
    const e2 = new URLSearchParams();
    e2.append("code", t2);
    for (let t3 = 1; t3 < arguments.length; t3++) e2.append("v", arguments[t3]);
    throw Error(`Minified Lexical error #${t2}; visit https://lexical.dev/docs/error?${e2} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }));
  const v$1 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement, C$1 = (t2) => v$1 ? (t2 || window).getSelection() : null;
  function D(e2, n2 = Oi()) {
    return null == n2 && y$1(166), yi(n2) && n2.isCollapsed() || 0 === n2.getNodes().length ? "" : h$2(e2, n2);
  }
  function N(t2, e2 = Oi()) {
    return null == e2 && y$1(166), yi(e2) && e2.isCollapsed() || 0 === e2.getNodes().length ? null : JSON.stringify(R(t2, e2));
  }
  function T(t2, n2, o2) {
    const r2 = t2.getData("application/x-lexical-editor");
    if (r2) try {
      const t3 = JSON.parse(r2);
      if (t3.namespace === o2._config.namespace && Array.isArray(t3.nodes)) {
        return S$1(o2, E$2(t3.nodes), n2);
      }
    } catch (t3) {
    }
    const s2 = t2.getData("text/html");
    if (s2) try {
      const t3 = new DOMParser().parseFromString(s2, "text/html");
      return S$1(o2, p$3(o2, t3), n2);
    } catch (t3) {
    }
    const a2 = t2.getData("text/plain") || t2.getData("text/uri-list");
    if (null != a2) if (yi(n2)) {
      const t3 = a2.split(/(\r?\n|\t)/);
      "" === t3[t3.length - 1] && t3.pop();
      for (let e2 = 0; e2 < t3.length; e2++) {
        const n3 = Oi();
        if (yi(n3)) {
          const o3 = t3[e2];
          "\n" === o3 || "\r\n" === o3 ? n3.insertParagraph() : "	" === o3 ? n3.insertNodes([ai()]) : n3.insertText(o3);
        }
      }
    } else n2.insertRawText(a2);
  }
  function S$1(t2, e2, n2) {
    t2.dispatchCommand(n$1, { nodes: e2, selection: n2 }) || n2.insertNodes(e2);
  }
  function A(t2, e2, n2, r2 = []) {
    let l2 = null === e2 || n2.isSelected(e2);
    const i2 = _s(n2) && n2.excludeFromCopy("html");
    let c2 = n2;
    if (null !== e2) {
      let t3 = Pn(n2);
      t3 = oi(t3) && null !== e2 ? E$5(e2, t3) : t3, c2 = t3;
    }
    const s2 = _s(c2) ? c2.getChildren() : [], a2 = (function(t3) {
      const e3 = t3.exportJSON(), n3 = t3.constructor;
      if (e3.type !== n3.getType() && y$1(58, n3.name), _s(t3)) {
        const t4 = e3.children;
        Array.isArray(t4) || y$1(59, n3.name);
      }
      return e3;
    })(c2);
    if (oi(c2)) {
      const t3 = c2.__text;
      t3.length > 0 ? a2.text = t3 : l2 = false;
    }
    for (let o2 = 0; o2 < s2.length; o2++) {
      const r3 = s2[o2], i3 = A(t2, e2, r3, a2.children);
      !l2 && _s(n2) && i3 && n2.extractWithChild(r3, e2, "clone") && (l2 = true);
    }
    if (l2 && !i2) r2.push(a2);
    else if (Array.isArray(a2.children)) for (let t3 = 0; t3 < a2.children.length; t3++) {
      const e3 = a2.children[t3];
      r2.push(e3);
    }
    return l2;
  }
  function R(t2, e2) {
    const n2 = [], o2 = we().getChildren();
    for (let r2 = 0; r2 < o2.length; r2++) {
      A(t2, e2, o2[r2], n2);
    }
    return { namespace: t2._config.namespace, nodes: n2 };
  }
  function E$2(t2) {
    const e2 = [];
    for (let o2 = 0; o2 < t2.length; o2++) {
      const r2 = t2[o2], l2 = ss(r2);
      oi(l2) && I$2(l2), e2.push(l2);
    }
    return e2;
  }
  let O = null;
  function P(t2, e2, n2) {
    return __async(this, null, function* () {
      if (null !== O) return false;
      if (null !== e2) return new Promise(((o3, r2) => {
        t2.update((() => {
          o3(b$1(t2, e2, n2));
        }));
      }));
      const o2 = t2.getRootElement(), l2 = null == t2._window ? window.document : t2._window.document, i2 = C$1(t2._window);
      if (null === o2 || null === i2) return false;
      const c2 = l2.createElement("span");
      c2.style.cssText = "position: fixed; top: -1000px;", c2.append(l2.createTextNode("#")), o2.append(c2);
      const s2 = new Range();
      return s2.setStart(c2, 0), s2.setEnd(c2, 1), i2.removeAllRanges(), i2.addRange(s2), new Promise(((e3, o3) => {
        const i3 = t2.registerCommand(M$5, ((o4) => (te(o4, ClipboardEvent) && (i3(), null !== O && (window.clearTimeout(O), O = null), e3(b$1(t2, o4, n2))), true)), Os);
        O = window.setTimeout((() => {
          i3(), O = null, e3(false);
        }), 50), l2.execCommand("copy"), c2.remove();
      }));
    });
  }
  function b$1(t2, e2, n2) {
    if (void 0 === n2) {
      const e3 = C$1(t2._window);
      if (!e3) return false;
      const o3 = e3.anchorNode, r2 = e3.focusNode;
      if (null !== o3 && null !== r2 && !le(t2, o3, r2)) return false;
      const l2 = Oi();
      if (null === l2) return false;
      n2 = M$1(l2);
    }
    e2.preventDefault();
    const o2 = e2.clipboardData;
    return null !== o2 && (F(o2, n2), true);
  }
  const J = [["text/html", D], ["application/x-lexical-editor", N]];
  function M$1(t2 = Oi()) {
    const e2 = { "text/plain": t2 ? t2.getTextContent() : "" };
    if (t2) {
      const n2 = bn();
      for (const [o2, r2] of J) {
        const l2 = r2(n2, t2);
        null !== l2 && (e2[o2] = l2);
      }
    }
    return e2;
  }
  function F(t2, e2) {
    for (const n2 in e2) {
      const o2 = e2[n2];
      void 0 !== o2 && t2.setData(n2, o2);
    }
  }
  function st(t2, e2) {
    if (void 0 !== document.caretRangeFromPoint) {
      const n2 = document.caretRangeFromPoint(t2, e2);
      return null === n2 ? null : { node: n2.startContainer, offset: n2.startOffset };
    }
    if ("undefined" !== document.caretPositionFromPoint) {
      const n2 = document.caretPositionFromPoint(t2, e2);
      return null === n2 ? null : { node: n2.offsetNode, offset: n2.offset };
    }
    return null;
  }
  const ct = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement, at = ct && "documentMode" in document ? document.documentMode : null, ut = !(!ct || !("InputEvent" in window) || at) && "getTargetRanges" in new window.InputEvent("input"), lt = ct && /Version\/[\d.]+.*Safari/.test(navigator.userAgent), dt = ct && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream, mt = ct && /^(?=.*Chrome).*/i.test(navigator.userAgent), ft = ct && /AppleWebKit\/[\d.]+/.test(navigator.userAgent) && !mt, gt = t$2();
  class pt extends gs {
    static getType() {
      return "quote";
    }
    static clone(t2) {
      return new pt(t2.__key);
    }
    constructor(t2) {
      super(t2);
    }
    createDOM(t2) {
      const e2 = document.createElement("blockquote");
      return $$1(e2, t2.theme.quote), e2;
    }
    updateDOM(t2, e2) {
      return false;
    }
    static importDOM() {
      return { blockquote: (t2) => ({ conversion: xt, priority: 0 }) };
    }
    exportDOM(t2) {
      const { element: e2 } = super.exportDOM(t2);
      if (e2 && vn(e2)) {
        this.isEmpty() && e2.append(document.createElement("br"));
        const t3 = this.getFormatType();
        e2.style.textAlign = t3;
        const n2 = this.getDirection();
        n2 && (e2.dir = n2);
      }
      return { element: e2 };
    }
    static importJSON(t2) {
      const e2 = ht();
      return e2.setFormat(t2.format), e2.setIndent(t2.indent), e2.setDirection(t2.direction), e2;
    }
    exportJSON() {
      return __spreadProps(__spreadValues({}, super.exportJSON()), { type: "quote" });
    }
    insertNewAfter(t2, e2) {
      const n2 = Ns(), r2 = this.getDirection();
      return n2.setDirection(r2), this.insertAfter(n2, e2), n2;
    }
    collapseAtStart() {
      const t2 = Ns();
      return this.getChildren().forEach(((e2) => t2.append(e2))), this.replace(t2), true;
    }
    canMergeWhenEmpty() {
      return true;
    }
  }
  function ht() {
    return fn(new pt());
  }
  class yt extends gs {
    static getType() {
      return "heading";
    }
    static clone(t2) {
      return new yt(t2.__tag, t2.__key);
    }
    constructor(t2, e2) {
      super(e2), this.__tag = t2;
    }
    getTag() {
      return this.__tag;
    }
    createDOM(t2) {
      const e2 = this.__tag, n2 = document.createElement(e2), r2 = t2.theme.heading;
      if (void 0 !== r2) {
        const t3 = r2[e2];
        $$1(n2, t3);
      }
      return n2;
    }
    updateDOM(t2, e2) {
      return false;
    }
    static importDOM() {
      return { h1: (t2) => ({ conversion: Dt, priority: 0 }), h2: (t2) => ({ conversion: Dt, priority: 0 }), h3: (t2) => ({ conversion: Dt, priority: 0 }), h4: (t2) => ({ conversion: Dt, priority: 0 }), h5: (t2) => ({ conversion: Dt, priority: 0 }), h6: (t2) => ({ conversion: Dt, priority: 0 }), p: (t2) => {
        const e2 = t2.firstChild;
        return null !== e2 && vt(e2) ? { conversion: () => ({ node: null }), priority: 3 } : null;
      }, span: (t2) => vt(t2) ? { conversion: (t3) => ({ node: wt("h1") }), priority: 3 } : null };
    }
    exportDOM(t2) {
      const { element: e2 } = super.exportDOM(t2);
      if (e2 && vn(e2)) {
        this.isEmpty() && e2.append(document.createElement("br"));
        const t3 = this.getFormatType();
        e2.style.textAlign = t3;
        const n2 = this.getDirection();
        n2 && (e2.dir = n2);
      }
      return { element: e2 };
    }
    static importJSON(t2) {
      const e2 = wt(t2.tag);
      return e2.setFormat(t2.format), e2.setIndent(t2.indent), e2.setDirection(t2.direction), e2;
    }
    exportJSON() {
      return __spreadProps(__spreadValues({}, super.exportJSON()), { tag: this.getTag(), type: "heading", version: 1 });
    }
    insertNewAfter(t2, e2 = true) {
      const n2 = t2 ? t2.anchor.offset : 0, r2 = this.getLastDescendant(), o2 = !r2 || t2 && t2.anchor.key === r2.getKey() && n2 === r2.getTextContentSize() || !t2 ? Ns() : wt(this.getTag()), i2 = this.getDirection();
      if (o2.setDirection(i2), this.insertAfter(o2, e2), 0 === n2 && !this.isEmpty() && t2) {
        const t3 = Ns();
        t3.select(), this.replace(t3, true);
      }
      return o2;
    }
    collapseAtStart() {
      const t2 = this.isEmpty() ? Ns() : wt(this.getTag());
      return this.getChildren().forEach(((e2) => t2.append(e2))), this.replace(t2), true;
    }
    extractWithChild() {
      return true;
    }
  }
  function vt(t2) {
    return "span" === t2.nodeName.toLowerCase() && "26pt" === t2.style.fontSize;
  }
  function Dt(t2) {
    const e2 = t2.nodeName.toLowerCase();
    let n2 = null;
    return "h1" !== e2 && "h2" !== e2 && "h3" !== e2 && "h4" !== e2 && "h5" !== e2 && "h6" !== e2 || (n2 = wt(e2), null !== t2.style && n2.setFormat(t2.style.textAlign)), { node: n2 };
  }
  function xt(t2) {
    const e2 = ht();
    return null !== t2.style && e2.setFormat(t2.style.textAlign), { node: e2 };
  }
  function wt(t2) {
    return fn(new yt(t2));
  }
  function Et(t2) {
    return t2 instanceof yt;
  }
  function Nt(t2) {
    let e2 = null;
    if (te(t2, DragEvent) ? e2 = t2.dataTransfer : te(t2, ClipboardEvent) && (e2 = t2.clipboardData), null === e2) return [false, [], false];
    const n2 = e2.types, r2 = n2.includes("Files"), o2 = n2.includes("text/html") || n2.includes("text/plain");
    return [r2, Array.from(e2.files), o2];
  }
  function It(t2) {
    const e2 = Oi();
    if (!yi(e2)) return false;
    const n2 = /* @__PURE__ */ new Set(), r2 = e2.getNodes();
    for (let e3 = 0; e3 < r2.length; e3++) {
      const o2 = r2[e3], i2 = o2.getKey();
      if (n2.has(i2)) continue;
      const s2 = Q(o2, ((t3) => _s(t3) && !t3.isInline()));
      if (null === s2) continue;
      const c2 = s2.getKey();
      s2.canIndent() && !n2.has(c2) && (n2.add(c2), t2(s2));
    }
    return n2.size > 0;
  }
  function Ot(t2) {
    const e2 = Ce(t2);
    return ms(e2);
  }
  function Tt(o2) {
    return b$3(o2.registerCommand(r$2, ((t2) => {
      const e2 = Oi();
      return !!xi(e2) && (e2.clear(), true);
    }), 0), o2.registerCommand(i$1, ((t2) => {
      const e2 = Oi();
      return !!yi(e2) && (e2.deleteCharacter(t2), true);
    }), Ps), o2.registerCommand(u$7, ((t2) => {
      const e2 = Oi();
      return !!yi(e2) && (e2.deleteWord(t2), true);
    }), Ps), o2.registerCommand(f$3, ((t2) => {
      const e2 = Oi();
      return !!yi(e2) && (e2.deleteLine(t2), true);
    }), Ps), o2.registerCommand(l$2, ((e2) => {
      const n2 = Oi();
      if ("string" == typeof e2) null !== n2 && n2.insertText(e2);
      else {
        if (null === n2) return false;
        const r2 = e2.dataTransfer;
        if (null != r2) T(r2, n2, o2);
        else if (yi(n2)) {
          const t2 = e2.data;
          return t2 && n2.insertText(t2), true;
        }
      }
      return true;
    }), Ps), o2.registerCommand(a$4, (() => {
      const t2 = Oi();
      return !!yi(t2) && (t2.removeText(), true);
    }), Ps), o2.registerCommand(d$3, ((t2) => {
      const e2 = Oi();
      return !!yi(e2) && (e2.formatText(t2), true);
    }), Ps), o2.registerCommand(L$4, ((t2) => {
      const e2 = Oi();
      if (!yi(e2) && !xi(e2)) return false;
      const n2 = e2.getNodes();
      for (const e3 of n2) {
        const n3 = Q(e3, ((t3) => _s(t3) && !t3.isInline()));
        null !== n3 && n3.setFormat(t2);
      }
      return true;
    }), Ps), o2.registerCommand(s$2, ((t2) => {
      const e2 = Oi();
      return !!yi(e2) && (e2.insertLineBreak(t2), true);
    }), Ps), o2.registerCommand(o$5, (() => {
      const t2 = Oi();
      return !!yi(t2) && (t2.insertParagraph(), true);
    }), Ps), o2.registerCommand(E$6, (() => (Ri([ai()]), true)), Ps), o2.registerCommand(P$2, (() => It(((t2) => {
      const e2 = t2.getIndent();
      t2.setIndent(e2 + 1);
    }))), Ps), o2.registerCommand(F$2, (() => It(((t2) => {
      const e2 = t2.getIndent();
      e2 > 0 && t2.setIndent(e2 - 1);
    }))), Ps), o2.registerCommand(v$3, ((t2) => {
      const e2 = Oi();
      if (xi(e2) && !Ot(t2.target)) {
        const t3 = e2.getNodes();
        if (t3.length > 0) return t3[0].selectPrevious(), true;
      } else if (yi(e2)) {
        const n2 = Xe(e2.focus, true);
        if (!t2.shiftKey && ms(n2) && !n2.isIsolated() && !n2.isInline()) return n2.selectPrevious(), t2.preventDefault(), true;
      }
      return false;
    }), Ps), o2.registerCommand(S$3, ((t2) => {
      const e2 = Oi();
      if (xi(e2)) {
        const t3 = e2.getNodes();
        if (t3.length > 0) return t3[0].selectNext(0, 0), true;
      } else if (yi(e2)) {
        if ((function(t3) {
          const e3 = t3.focus;
          return "root" === e3.key && e3.offset === we().getChildrenSize();
        })(e2)) return t2.preventDefault(), true;
        const n2 = Xe(e2.focus, false);
        if (!t2.shiftKey && ms(n2) && !n2.isIsolated() && !n2.isInline()) return n2.selectNext(), t2.preventDefault(), true;
      }
      return false;
    }), Ps), o2.registerCommand(m$7, ((t2) => {
      const e2 = Oi();
      if (xi(e2)) {
        const n2 = e2.getNodes();
        if (n2.length > 0) return t2.preventDefault(), n2[0].selectPrevious(), true;
      }
      if (!yi(e2)) return false;
      if (A$3(e2, true)) {
        const n2 = t2.shiftKey;
        return t2.preventDefault(), M$4(e2, n2, true), true;
      }
      return false;
    }), Ps), o2.registerCommand(p$7, ((t2) => {
      const e2 = Oi();
      if (xi(e2) && !Ot(t2.target)) {
        const n2 = e2.getNodes();
        if (n2.length > 0) return t2.preventDefault(), n2[0].selectNext(0, 0), true;
      }
      if (!yi(e2)) return false;
      const o3 = t2.shiftKey;
      return !!A$3(e2, false) && (t2.preventDefault(), M$4(e2, o3, false), true);
    }), Ps), o2.registerCommand(k$4, ((t2) => {
      if (Ot(t2.target)) return false;
      const e2 = Oi();
      if (!yi(e2)) return false;
      t2.preventDefault();
      const { anchor: n2 } = e2, r2 = n2.getNode();
      if (e2.isCollapsed() && 0 === n2.offset && !vs(r2)) {
        if (J$3(r2).getIndent() > 0) return o2.dispatchCommand(F$2, void 0);
      }
      return o2.dispatchCommand(i$1, true);
    }), Ps), o2.registerCommand(w$5, ((t2) => {
      if (Ot(t2.target)) return false;
      const e2 = Oi();
      return !!yi(e2) && (t2.preventDefault(), o2.dispatchCommand(i$1, false));
    }), Ps), o2.registerCommand(T$3, ((t2) => {
      const e2 = Oi();
      if (!yi(e2)) return false;
      if (null !== t2) {
        if ((dt || lt || ft) && ut) return false;
        if (t2.preventDefault(), t2.shiftKey) return o2.dispatchCommand(s$2, false);
      }
      return o2.dispatchCommand(o$5, void 0);
    }), Ps), o2.registerCommand(b$4, (() => {
      const t2 = Oi();
      return !!yi(t2) && (o2.blur(), true);
    }), Ps), o2.registerCommand(D$4, ((t2) => {
      const [, e2] = Nt(t2);
      if (e2.length > 0) {
        const n3 = st(t2.clientX, t2.clientY);
        if (null !== n3) {
          const { offset: t3, node: r2 } = n3, i2 = Ce(r2);
          if (null !== i2) {
            const e3 = Pi();
            if (oi(i2)) e3.anchor.set(i2.getKey(), t3, "text"), e3.focus.set(i2.getKey(), t3, "text");
            else {
              const t4 = i2.getParentOrThrow().getKey(), n5 = i2.getIndexWithinParent() + 1;
              e3.anchor.set(t4, n5, "element"), e3.focus.set(t4, n5, "element");
            }
            const n4 = ee(e3);
            Ee(n4);
          }
          o2.dispatchCommand(gt, e2);
        }
        return t2.preventDefault(), true;
      }
      const n2 = Oi();
      return !!yi(n2);
    }), Ps), o2.registerCommand(O$4, ((t2) => {
      const [e2] = Nt(t2), n2 = Oi();
      return !(e2 && !yi(n2));
    }), Ps), o2.registerCommand(I$3, ((t2) => {
      const [e2] = Nt(t2), n2 = Oi();
      if (e2 && !yi(n2)) return false;
      const r2 = st(t2.clientX, t2.clientY);
      if (null !== r2) {
        const e3 = Ce(r2.node);
        ms(e3) && t2.preventDefault();
      }
      return true;
    }), Ps), o2.registerCommand(z$2, (() => (Ve(), true)), Ps), o2.registerCommand(M$5, ((t2) => (P(o2, te(t2, ClipboardEvent) ? t2 : null), true)), Ps), o2.registerCommand(W$1, ((t2) => ((function(t3, n2) {
      return __async(this, null, function* () {
        yield P(n2, te(t3, ClipboardEvent) ? t3 : null), n2.update((() => {
          const t4 = Oi();
          yi(t4) ? t4.removeText() : xi(t4) && t4.getNodes().forEach(((t5) => t5.remove()));
        }));
      });
    })(t2, o2), true)), Ps), o2.registerCommand(c$3, ((e2) => {
      const [, n2, r2] = Nt(e2);
      if (n2.length > 0 && !r2) return o2.dispatchCommand(gt, n2), true;
      if (oe(e2.target)) return false;
      return null !== Oi() && ((function(e3, n3) {
        e3.preventDefault(), n3.update((() => {
          const r3 = Oi(), o3 = te(e3, InputEvent) || te(e3, KeyboardEvent) ? null : e3.clipboardData;
          null != o3 && null !== r3 && T(o3, r3, n3);
        }), { tag: "paste" });
      })(e2, o2), true);
    }), Ps));
  }
  const s$1 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement, m$2 = s$1 ? reactExports.useLayoutEffect : reactExports.useEffect, u$4 = { tag: "history-merge" };
  function p$2({ initialConfig: a2, children: c2 }) {
    const p2 = reactExports.useMemo((() => {
      const { theme: t2, namespace: c3, nodes: l2, onError: d2, editorState: m2, html: p3 } = a2, f2 = o$3(null, t2), E2 = As({ editable: a2.editable, html: p3, namespace: c3, nodes: l2, onError: (e2) => d2(e2, E2), theme: t2 });
      return (function(e2, t3) {
        if (null === t3) return;
        if (void 0 === t3) e2.update((() => {
          const t4 = we();
          if (t4.isEmpty()) {
            const o2 = Ns();
            t4.append(o2);
            const n2 = s$1 ? document.activeElement : null;
            (null !== Oi() || null !== n2 && n2 === e2.getRootElement()) && o2.select();
          }
        }), u$4);
        else if (null !== t3) switch (typeof t3) {
          case "string": {
            const o2 = e2.parseEditorState(t3);
            e2.setEditorState(o2, u$4);
            break;
          }
          case "object":
            e2.setEditorState(t3, u$4);
            break;
          case "function":
            e2.update((() => {
              we().isEmpty() && t3(e2);
            }), u$4);
        }
      })(E2, m2), [E2, f2];
    }), []);
    return m$2((() => {
      const e2 = a2.editable, [t2] = p2;
      t2.setEditable(void 0 === e2 || e2);
    }), []), jsxRuntimeExports.jsx(l$1.Provider, { value: p2, children: c2 });
  }
  function s() {
    return we().getTextContent();
  }
  function u$3(t2, e2 = true) {
    if (t2) return false;
    let n2 = s();
    return e2 && (n2 = n2.trim()), "" === n2;
  }
  function c$1(o2) {
    if (!u$3(o2, false)) return false;
    const l2 = we().getChildren(), s2 = l2.length;
    if (s2 > 1) return false;
    for (let t2 = 0; t2 < s2; t2++) {
      const o3 = l2[t2];
      if (ms(o3)) return false;
      if (_s(o3)) {
        if (!Es(o3)) return false;
        if (0 !== o3.__indent) return false;
        const e2 = o3.getChildren(), n2 = e2.length;
        for (let r2 = 0; r2 < n2; r2++) {
          const n3 = e2[t2];
          if (!oi(n3)) return false;
        }
      }
    }
    return true;
  }
  function g$2(t2) {
    return () => c$1(t2);
  }
  function d$1(t2) {
    return t2 && t2.__esModule && Object.prototype.hasOwnProperty.call(t2, "default") ? t2.default : t2;
  }
  d$1((function(t2) {
    const e2 = new URLSearchParams();
    e2.append("code", t2);
    for (let t3 = 1; t3 < arguments.length; t3++) e2.append("v", arguments[t3]);
    throw Error(`Minified Lexical error #${t2}; visit https://lexical.dev/docs/error?${e2} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }));
  const m$1 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement ? reactExports.useLayoutEffect : reactExports.useEffect;
  function f$1(_c, D2) {
    var _d = _c, { editor: e2, ariaActiveDescendant: t2, ariaAutoComplete: i2, ariaControls: a2, ariaDescribedBy: d2, ariaExpanded: c2, ariaLabel: s2, ariaLabelledBy: u2, ariaMultiline: f2, ariaOwns: b2, ariaRequired: p2, autoCapitalize: x2, className: E2, id: v2, role: w2 = "textbox", spellCheck: y2 = true, style: C2, tabIndex: h2, "data-testid": L2 } = _d, g2 = __objRest(_d, ["editor", "ariaActiveDescendant", "ariaAutoComplete", "ariaControls", "ariaDescribedBy", "ariaExpanded", "ariaLabel", "ariaLabelledBy", "ariaMultiline", "ariaOwns", "ariaRequired", "autoCapitalize", "className", "id", "role", "spellCheck", "style", "tabIndex", "data-testid"]);
    const [R2, k2] = reactExports.useState(e2.isEditable()), q2 = reactExports.useCallback(((t3) => {
      t3 && t3.ownerDocument && t3.ownerDocument.defaultView ? e2.setRootElement(t3) : e2.setRootElement(null);
    }), [e2]), z2 = reactExports.useMemo((() => /* @__PURE__ */ (function(...e3) {
      return (t3) => {
        e3.forEach(((e4) => {
          "function" == typeof e4 ? e4(t3) : null != e4 && (e4.current = t3);
        }));
      };
    })(D2, q2)), [q2, D2]);
    return m$1((() => (k2(e2.isEditable()), e2.registerEditableListener(((e3) => {
      k2(e3);
    })))), [e2]), jsxRuntimeExports.jsx("div", __spreadProps(__spreadValues({}, g2), { "aria-activedescendant": R2 ? t2 : void 0, "aria-autocomplete": R2 ? i2 : "none", "aria-controls": R2 ? a2 : void 0, "aria-describedby": d2, "aria-expanded": R2 && "combobox" === w2 ? !!c2 : void 0, "aria-label": s2, "aria-labelledby": u2, "aria-multiline": f2, "aria-owns": R2 ? b2 : void 0, "aria-readonly": !R2 || void 0, "aria-required": p2, autoCapitalize: x2, className: E2, contentEditable: R2, "data-testid": L2, id: v2, ref: z2, role: R2 ? w2 : void 0, spellCheck: y2, style: C2, tabIndex: h2 }));
  }
  const b = reactExports.forwardRef(f$1);
  function p$1(e2) {
    return e2.getEditorState().read(g$2(e2.isComposing()));
  }
  const x$1 = reactExports.forwardRef(E$1);
  function E$1(t2, i2) {
    const _a = t2, { placeholder: a2 } = _a, r2 = __objRest(_a, ["placeholder"]), [n2] = u$6();
    return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [jsxRuntimeExports.jsx(b, __spreadProps(__spreadValues({ editor: n2 }, r2), { ref: i2 })), null != a2 && jsxRuntimeExports.jsx(v, { editor: n2, content: a2 })] });
  }
  function v({ content: e2, editor: i2 }) {
    const a2 = (function(e3) {
      const [t2, i3] = reactExports.useState((() => p$1(e3)));
      return m$1((() => {
        function t3() {
          const t4 = p$1(e3);
          i3(t4);
        }
        return t3(), b$3(e3.registerUpdateListener((() => {
          t3();
        })), e3.registerEditableListener((() => {
          t3();
        })));
      }), [e3]), t2;
    })(i2), [n2, o2] = reactExports.useState(i2.isEditable());
    if (reactExports.useLayoutEffect((() => (o2(i2.isEditable()), i2.registerEditableListener(((e3) => {
      o2(e3);
    })))), [i2]), !a2) return null;
    let d2 = null;
    return "function" == typeof e2 ? d2 = e2(n2) : null !== e2 && (d2 = e2), null === d2 ? null : jsxRuntimeExports.jsx("div", { "aria-hidden": true, children: d2 });
  }
  const l = 0, f = 1, p = 2, h$1 = 0, m = 1, g$1 = 2, _ = 3, S = 4;
  function y(t2, e2, n2, r2, o2) {
    if (null === t2 || 0 === n2.size && 0 === r2.size && !o2) return h$1;
    const i2 = e2._selection, s2 = t2._selection;
    if (o2) return m;
    if (!(yi(i2) && yi(s2) && s2.isCollapsed() && i2.isCollapsed())) return h$1;
    const c2 = (function(t3, e3, n3) {
      const r3 = t3._nodeMap, o3 = [];
      for (const t4 of e3) {
        const e4 = r3.get(t4);
        void 0 !== e4 && o3.push(e4);
      }
      for (const [t4, e4] of n3) {
        if (!e4) continue;
        const n4 = r3.get(t4);
        void 0 === n4 || vs(n4) || o3.push(n4);
      }
      return o3;
    })(e2, n2, r2);
    if (0 === c2.length) return h$1;
    if (c2.length > 1) {
      const n3 = e2._nodeMap, r3 = n3.get(i2.anchor.key), o3 = n3.get(s2.anchor.key);
      return r3 && o3 && !t2._nodeMap.has(r3.__key) && oi(r3) && 1 === r3.__text.length && 1 === i2.anchor.offset ? g$1 : h$1;
    }
    const l2 = c2[0], f2 = t2._nodeMap.get(l2.__key);
    if (!oi(f2) || !oi(l2) || f2.__mode !== l2.__mode) return h$1;
    const p2 = f2.__text, y2 = l2.__text;
    if (p2 === y2) return h$1;
    const k2 = i2.anchor, C2 = s2.anchor;
    if (k2.key !== C2.key || "text" !== k2.type) return h$1;
    const x2 = k2.offset, M2 = C2.offset, z2 = y2.length - p2.length;
    return 1 === z2 && M2 === x2 - 1 ? g$1 : -1 === z2 && M2 === x2 + 1 ? _ : -1 === z2 && M2 === x2 ? S : h$1;
  }
  function k(t2, e2) {
    let n2 = Date.now(), r2 = h$1;
    return (o2, i2, s2, c2, d2, m2) => {
      const g2 = Date.now();
      if (m2.has("historic")) return r2 = h$1, n2 = g2, p;
      const _2 = y(o2, i2, c2, d2, t2.isComposing()), S2 = (() => {
        const S3 = null === s2 || s2.editor === t2, y2 = m2.has("history-push");
        if (!y2 && S3 && m2.has("history-merge")) return l;
        if (null === o2) return f;
        const k2 = i2._selection;
        if (!(c2.size > 0 || d2.size > 0)) return null !== k2 ? l : p;
        if (false === y2 && _2 !== h$1 && _2 === r2 && g2 < n2 + e2 && S3) return l;
        if (1 === c2.size) {
          if ((function(t3, e3, n3) {
            const r3 = e3._nodeMap.get(t3), o3 = n3._nodeMap.get(t3), i3 = e3._selection, s3 = n3._selection;
            return !(yi(i3) && yi(s3) && "element" === i3.anchor.type && "element" === i3.focus.type && "text" === s3.anchor.type && "text" === s3.focus.type || !oi(r3) || !oi(o3) || r3.__parent !== o3.__parent) && JSON.stringify(e3.read((() => r3.exportJSON()))) === JSON.stringify(n3.read((() => o3.exportJSON())));
          })(Array.from(c2)[0], o2, i2)) return l;
        }
        return f;
      })();
      return n2 = g2, r2 = _2, S2;
    };
  }
  function C(t2) {
    t2.undoStack = [], t2.redoStack = [], t2.current = null;
  }
  function x(a2, u2, d2) {
    const l2 = k(a2, d2), h2 = b$3(a2.registerCommand(h$5, (() => ((function(t2, e2) {
      const n2 = e2.redoStack, r2 = e2.undoStack;
      if (0 !== r2.length) {
        const o2 = e2.current, i2 = r2.pop();
        null !== o2 && (n2.push(o2), t2.dispatchCommand(K$1, true)), 0 === r2.length && t2.dispatchCommand($$2, false), e2.current = i2 || null, i2 && i2.editor.setEditorState(i2.editorState, { tag: "historic" });
      }
    })(a2, u2), true)), Ps), a2.registerCommand(g$6, (() => ((function(t2, e2) {
      const n2 = e2.redoStack, r2 = e2.undoStack;
      if (0 !== n2.length) {
        const o2 = e2.current;
        null !== o2 && (r2.push(o2), t2.dispatchCommand($$2, true));
        const i2 = n2.pop();
        0 === n2.length && t2.dispatchCommand(K$1, false), e2.current = i2 || null, i2 && i2.editor.setEditorState(i2.editorState, { tag: "historic" });
      }
    })(a2, u2), true)), Ps), a2.registerCommand(B$3, (() => (C(u2), false)), Ps), a2.registerCommand(R$3, (() => (C(u2), a2.dispatchCommand(K$1, false), a2.dispatchCommand($$2, false), true)), Ps), a2.registerUpdateListener((({ editorState: t2, prevEditorState: e2, dirtyLeaves: n2, dirtyElements: r2, tags: o2 }) => {
      const i2 = u2.current, d3 = u2.redoStack, h3 = u2.undoStack, m2 = null === i2 ? null : i2.editorState;
      if (null !== i2 && t2 === m2) return;
      const g2 = l2(e2, t2, i2, n2, r2, o2);
      if (g2 === f) 0 !== d3.length && (u2.redoStack = [], a2.dispatchCommand(K$1, false)), null !== i2 && (h3.push(__spreadValues({}, i2)), a2.dispatchCommand($$2, true));
      else if (g2 === p) return;
      u2.current = { editor: a2, editorState: t2 };
    })));
    return h2;
  }
  function M() {
    return { current: null, redoStack: [], undoStack: [] };
  }
  function a$2({ delay: a2, externalHistoryState: c2 }) {
    const [l2] = u$6();
    return (function(t2, a3, c3 = 1e3) {
      const l3 = reactExports.useMemo((() => a3 || M()), [a3]);
      reactExports.useEffect((() => x(t2, l3, c3)), [c3, t2, l3]);
    })(l2, c2, a2), null;
  }
  function u$2({ validateUrl: u2 }) {
    const [p2] = u$6();
    return reactExports.useEffect((() => {
      if (!p2.hasNodes([o$4])) throw new Error("LinkPlugin: LinkNode not registered on editor");
      return b$3(p2.registerCommand(p$5, ((t2) => {
        if (null === t2) return U$1(t2), true;
        if ("string" == typeof t2) return !(void 0 !== u2 && !u2(t2)) && (U$1(t2), true);
        {
          const { url: r2, target: o2, rel: i2, title: n2 } = t2;
          return U$1(r2, { rel: i2, target: o2, title: n2 }), true;
        }
      }), Fs), void 0 !== u2 ? p2.registerCommand(c$3, ((t2) => {
        const e2 = Oi();
        if (!yi(e2) || e2.isCollapsed() || !te(t2, ClipboardEvent)) return false;
        const o2 = t2;
        if (null === o2.clipboardData) return false;
        const i2 = o2.clipboardData.getData("text");
        return !!u2(i2) && (!e2.getNodes().some(((t3) => _s(t3))) && (p2.dispatchCommand(p$5, i2), t2.preventDefault(), true));
      }), Fs) : () => {
      });
    }), [p2, u2]), null;
  }
  const r = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement ? reactExports.useLayoutEffect : reactExports.useEffect;
  function i({ ignoreHistoryMergeTagChange: t2 = true, ignoreSelectionChange: o2 = false, onChange: i2 }) {
    const [n2] = u$6();
    return r((() => {
      if (i2) return n2.registerUpdateListener((({ editorState: e2, dirtyElements: r2, dirtyLeaves: a2, prevEditorState: d2, tags: s2 }) => {
        o2 && 0 === r2.size && 0 === a2.size || t2 && s2.has("history-merge") || d2.isEmpty() || i2(e2, n2, s2);
      }));
    }), [n2, t2, o2, i2]), null;
  }
  const u$1 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement ? reactExports.useLayoutEffect : reactExports.useEffect;
  function c(e2) {
    return { initialValueFn: () => e2.isEditable(), subscribe: (t2) => e2.registerEditableListener(t2) };
  }
  function a$1() {
    return (function(t2) {
      const [n2] = u$6(), c2 = reactExports.useMemo((() => t2(n2)), [n2, t2]), a2 = reactExports.useRef(c2.initialValueFn()), [l2, d2] = reactExports.useState(a2.current);
      return u$1((() => {
        const { initialValueFn: e2, subscribe: t3 } = c2, n3 = e2();
        return a2.current !== n3 && (a2.current = n3, d2(n3)), t3(((e3) => {
          a2.current = e3, d2(e3);
        }));
      }), [c2, t2]), l2;
    })(c);
  }
  var reactDomExports = requireReactDom();
  function o$2(o2) {
    const i2 = window.location.origin, a2 = (a3) => {
      if (a3.origin !== i2) return;
      const r2 = o2.getRootElement();
      if (document.activeElement !== r2) return;
      const s2 = a3.data;
      if ("string" == typeof s2) {
        let i3;
        try {
          i3 = JSON.parse(s2);
        } catch (e2) {
          return;
        }
        if (i3 && "nuanria_messaging" === i3.protocol && "request" === i3.type) {
          const r3 = i3.payload;
          if (r3 && "makeChanges" === r3.functionId) {
            const i4 = r3.args;
            if (i4) {
              const [r4, s3, c2, g2, d2, f2] = i4;
              o2.update((() => {
                const o3 = Oi();
                if (yi(o3)) {
                  const e2 = o3.anchor;
                  let t2 = e2.getNode(), i5 = 0, f3 = 0;
                  if (oi(t2) && r4 >= 0 && s3 >= 0 && (i5 = r4, f3 = r4 + s3, o3.setTextNodeRange(t2, i5, t2, f3)), i5 === f3 && "" === c2 || (o3.insertRawText(c2), t2 = e2.getNode()), oi(t2)) {
                    i5 = g2, f3 = g2 + d2;
                    const e3 = t2.getTextContentSize();
                    i5 = i5 > e3 ? e3 : i5, f3 = f3 > e3 ? e3 : f3, o3.setTextNodeRange(t2, i5, t2, f3);
                  }
                  a3.stopImmediatePropagation();
                }
              }));
            }
          }
        }
      }
    };
    return window.addEventListener("message", a2, true), () => {
      window.removeEventListener("message", a2, true);
    };
  }
  const g = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement ? reactExports.useLayoutEffect : reactExports.useEffect;
  function E(t2) {
    return t2.getEditorState().read(g$2(t2.isComposing()));
  }
  function h({ contentEditable: e2, placeholder: r2 = null, ErrorBoundary: n2 }) {
    const [E2] = u$6(), h2 = (function(t2, e3) {
      const [r3, o2] = reactExports.useState((() => t2.getDecorators()));
      return g((() => t2.registerDecoratorListener(((t3) => {
        reactDomExports.flushSync((() => {
          o2(t3);
        }));
      }))), [t2]), reactExports.useEffect((() => {
        o2(t2.getDecorators());
      }), [t2]), reactExports.useMemo((() => {
        const o3 = [], n3 = Object.keys(r3);
        for (let i2 = 0; i2 < n3.length; i2++) {
          const c2 = n3[i2], l2 = jsxRuntimeExports.jsx(e3, { onError: (e4) => t2._onError(e4), children: jsxRuntimeExports.jsx(reactExports.Suspense, { fallback: null, children: r3[c2] }) }), u2 = t2.getElementByKey(c2);
          null !== u2 && o3.push(reactDomExports.createPortal(l2, u2, c2));
        }
        return o3;
      }), [e3, r3, t2]);
    })(E2, n2);
    return (function(t2) {
      g((() => b$3(Tt(t2), o$2(t2))), [t2]);
    })(E2), jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [e2, jsxRuntimeExports.jsx(w, { content: r2 }), h2] });
  }
  function w({ content: r2 }) {
    const [n2] = u$6(), i2 = (function(t2) {
      const [e2, r3] = reactExports.useState((() => E(t2)));
      return g((() => {
        function e3() {
          const e4 = E(t2);
          r3(e4);
        }
        return e3(), b$3(t2.registerUpdateListener((() => {
          e3();
        })), t2.registerEditableListener((() => {
          e3();
        })));
      }), [t2]), e2;
    })(n2), l2 = a$1();
    return i2 ? "function" == typeof r2 ? r2(l2) : r2 : null;
  }
  function t(r2, e2) {
    return t = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(r3, e3) {
      return r3.__proto__ = e3, r3;
    }, t(r2, e2);
  }
  var o$1 = { error: null }, n = (function(e2) {
    var n2, a2;
    function s2() {
      for (var r2, t2 = arguments.length, n3 = new Array(t2), a3 = 0; a3 < t2; a3++) n3[a3] = arguments[a3];
      return (r2 = e2.call.apply(e2, [this].concat(n3)) || this).state = o$1, r2.resetErrorBoundary = function() {
        for (var e3, t3 = arguments.length, o2 = new Array(t3), n4 = 0; n4 < t3; n4++) o2[n4] = arguments[n4];
        null == r2.props.onReset || (e3 = r2.props).onReset.apply(e3, o2), r2.reset();
      }, r2;
    }
    a2 = e2, (n2 = s2).prototype = Object.create(a2.prototype), n2.prototype.constructor = n2, t(n2, a2), s2.getDerivedStateFromError = function(r2) {
      return { error: r2 };
    };
    var l2 = s2.prototype;
    return l2.reset = function() {
      this.setState(o$1);
    }, l2.componentDidCatch = function(r2, e3) {
      var t2, o2;
      null == (t2 = (o2 = this.props).onError) || t2.call(o2, r2, e3);
    }, l2.componentDidUpdate = function(r2, e3) {
      var t2, o2, n3, a3, s3 = this.state.error, l3 = this.props.resetKeys;
      null !== s3 && null !== e3.error && (void 0 === (n3 = r2.resetKeys) && (n3 = []), void 0 === (a3 = l3) && (a3 = []), n3.length !== a3.length || n3.some((function(r3, e4) {
        return !Object.is(r3, a3[e4]);
      }))) && (null == (t2 = (o2 = this.props).onResetKeysChange) || t2.call(o2, r2.resetKeys, l3), this.reset());
    }, l2.render = function() {
      var e3 = this.state.error, t2 = this.props, o2 = t2.fallbackRender, n3 = t2.FallbackComponent, a3 = t2.fallback;
      if (null !== e3) {
        var s3 = { error: e3, resetErrorBoundary: this.resetErrorBoundary };
        if (reactExports.isValidElement(a3)) return a3;
        if ("function" == typeof o2) return o2(s3);
        if (n3) return reactExports.createElement(n3, s3);
        throw new Error("react-error-boundary requires either a fallback, fallbackRender, or FallbackComponent prop");
      }
      return this.props.children;
    }, s2;
  })(reactExports.Component);
  function a({ children: r2, onError: t2 }) {
    return jsxRuntimeExports.jsx(n, { fallback: jsxRuntimeExports.jsx("div", { style: { border: "1px solid #f00", color: "#f00", padding: "8px" }, children: "An error was thrown." }), onError: t2, children: r2 });
  }
  function o({ defaultSelection: o2 }) {
    const [l2] = u$6();
    return reactExports.useEffect((() => {
      l2.focus((() => {
        const e2 = document.activeElement, t2 = l2.getRootElement();
        null === t2 || null !== e2 && t2.contains(e2) || t2.focus({ preventScroll: true });
      }), { defaultSelection: o2 });
    }), [o2, l2]), null;
  }
  function PaperclipIcon() {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "svg",
      {
        "aria-hidden": "true",
        focusable: "false",
        width: "14",
        height: "14",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19" })
      }
    );
  }
  class AttachmentNode extends ys {
    constructor(href, fileName, mimeType, assetId, key) {
      super(key);
      __publicField(this, "__href");
      __publicField(this, "__fileName");
      __publicField(this, "__mimeType");
      __publicField(this, "__assetId");
      this.__href = href;
      this.__fileName = fileName;
      this.__mimeType = mimeType;
      this.__assetId = assetId;
    }
    static getType() {
      return "attachment";
    }
    static clone(node) {
      return new AttachmentNode(
        node.__href,
        node.__fileName,
        node.__mimeType,
        node.__assetId,
        node.getKey()
      );
    }
    static importJSON(serializedNode) {
      const { href, fileName, mimeType, assetId } = serializedNode;
      return new AttachmentNode(href, fileName, mimeType, assetId);
    }
    getAssetId() {
      return this.__assetId;
    }
    exportJSON() {
      return {
        type: "attachment",
        version: 1,
        href: this.__href,
        fileName: this.__fileName,
        mimeType: this.__mimeType,
        assetId: this.__assetId
      };
    }
    createDOM() {
      const container = document.createElement("span");
      container.className = "lockin-note-attachment-wrapper";
      return container;
    }
    updateDOM() {
      return false;
    }
    decorate() {
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "a",
        {
          href: this.__href,
          target: "_blank",
          rel: "noreferrer",
          className: "lockin-note-attachment-chip",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-note-attachment-chip-icon", children: /* @__PURE__ */ jsxRuntimeExports.jsx(PaperclipIcon, {}) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-note-attachment-name", children: this.__fileName || "Attachment" }),
            this.__mimeType ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-note-attachment-meta", children: this.__mimeType }) : null
          ]
        }
      );
    }
  }
  function $createAttachmentNode(params) {
    var _a;
    return new AttachmentNode(params.href, params.fileName, params.mimeType, (_a = params.assetId) != null ? _a : null);
  }
  function $isAttachmentNode(node) {
    return node instanceof AttachmentNode;
  }
  function d(e2, t2) {
    return e2.getEditorState().read((() => {
      const e3 = Se(t2);
      return null !== e3 && e3.isSelected();
    }));
  }
  function u(c2) {
    const [u2] = u$6(), [p2, s2] = reactExports.useState((() => d(u2, c2)));
    reactExports.useEffect((() => {
      let e2 = true;
      const t2 = u2.registerUpdateListener((() => {
        e2 && s2(d(u2, c2));
      }));
      return () => {
        e2 = false, t2();
      };
    }), [u2, c2]);
    return [p2, reactExports.useCallback(((e2) => {
      u2.update((() => {
        let a2 = Oi();
        xi(a2) || (a2 = Fi(), Ee(a2)), xi(a2) && (e2 ? a2.add(c2) : a2.delete(c2));
      }));
    }), [u2, c2]), reactExports.useCallback((() => {
      u2.update((() => {
        const e2 = Oi();
        xi(e2) && e2.clear();
      }));
    }), [u2])];
  }
  const DEFAULT_WIDTH = 320;
  const MIN_WIDTH = 80;
  const MAX_WIDTH = 960;
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  function getMaxWidth(editor) {
    var _a;
    const root = editor.getRootElement();
    const scrollContainer = root == null ? void 0 : root.closest(
      ".lockin-note-editor-scroll"
    );
    const container = scrollContainer != null ? scrollContainer : root == null ? void 0 : root.parentElement;
    const measured = (_a = container == null ? void 0 : container.getBoundingClientRect().width) != null ? _a : 0;
    return measured > 0 ? clamp(measured - 48, MIN_WIDTH, MAX_WIDTH) : MAX_WIDTH;
  }
  function ResizableImage({
    src,
    alt,
    nodeKey,
    assetId,
    width,
    height
  }) {
    const [editor] = u$6();
    const [isSelected, setSelected, clearSelection] = u(nodeKey);
    const containerRef = reactExports.useRef(null);
    const imageRef = reactExports.useRef(null);
    const [dimensions, setDimensions] = reactExports.useState({
      width: width != null ? width : DEFAULT_WIDTH,
      height: height != null ? height : DEFAULT_WIDTH,
      aspectRatio: 1,
      maxWidth: MAX_WIDTH
    });
    const [isResizing, setIsResizing] = reactExports.useState(false);
    const resizeRef = reactExports.useRef({
      startX: 0,
      startY: 0,
      startWidth: 0,
      aspectRatio: 1,
      maxWidth: MAX_WIDTH
    });
    reactExports.useEffect(() => {
      if (width != null && height != null) {
        setDimensions((prev) => __spreadProps(__spreadValues({}, prev), {
          width,
          height,
          aspectRatio: width / height || 1
        }));
      }
    }, [width, height]);
    reactExports.useEffect(() => {
      const updateMaxWidth = () => {
        const maxWidth = getMaxWidth(editor);
        setDimensions((prev) => {
          const newWidth = clamp(prev.width, MIN_WIDTH, maxWidth);
          return __spreadProps(__spreadValues({}, prev), {
            maxWidth,
            width: newWidth,
            height: newWidth / prev.aspectRatio
          });
        });
      };
      updateMaxWidth();
      window.addEventListener("resize", updateMaxWidth);
      return () => window.removeEventListener("resize", updateMaxWidth);
    }, [editor]);
    const handleImageLoad = reactExports.useCallback(() => {
      const img = imageRef.current;
      if (!img) return;
      const { naturalWidth, naturalHeight } = img;
      const aspectRatio = naturalWidth / naturalHeight || 1;
      const maxWidth = getMaxWidth(editor);
      const targetWidth = width != null ? width : clamp(Math.min(naturalWidth, maxWidth), MIN_WIDTH, maxWidth);
      const targetHeight = height != null ? height : targetWidth / aspectRatio;
      setDimensions({
        width: targetWidth,
        height: targetHeight,
        aspectRatio,
        maxWidth
      });
      if (width == null || height == null) {
        editor.update(() => {
          const node = Se(nodeKey);
          if ($isImageNode(node)) {
            node.setWidth(targetWidth);
            node.setHeight(targetHeight);
          }
        });
      }
    }, [editor, nodeKey, width, height]);
    const commitDimensions = reactExports.useCallback(
      (w2, h2) => {
        editor.update(() => {
          const node = Se(nodeKey);
          if ($isImageNode(node)) {
            node.setWidth(w2);
            node.setHeight(h2);
          }
        });
      },
      [editor, nodeKey]
    );
    const handleResizeStart = reactExports.useCallback(
      (e2, corner) => {
        e2.preventDefault();
        e2.stopPropagation();
        const target = e2.target;
        target.setPointerCapture(e2.pointerId);
        const maxWidth = getMaxWidth(editor);
        resizeRef.current = {
          startX: e2.clientX,
          startY: e2.clientY,
          startWidth: dimensions.width,
          aspectRatio: dimensions.aspectRatio,
          maxWidth
        };
        setIsResizing(true);
        const onPointerMove = (moveEvent) => {
          const { startX, startY, startWidth, aspectRatio, maxWidth: maxWidth2 } = resizeRef.current;
          const deltaX = moveEvent.clientX - startX;
          const deltaY = moveEvent.clientY - startY;
          let widthDelta = 0;
          switch (corner) {
            // Corner handles (diagonal movement)
            case "se":
              widthDelta = Math.max(deltaX, deltaY * aspectRatio);
              break;
            case "sw":
              widthDelta = Math.max(-deltaX, deltaY * aspectRatio);
              break;
            case "ne":
              widthDelta = Math.max(deltaX, -deltaY * aspectRatio);
              break;
            case "nw":
              widthDelta = Math.max(-deltaX, -deltaY * aspectRatio);
              break;
            // Horizontal edge handles
            case "e":
              widthDelta = deltaX;
              break;
            case "w":
              widthDelta = -deltaX;
              break;
            // Vertical edge handles (convert Y to width via aspect ratio)
            case "s":
              widthDelta = deltaY * aspectRatio;
              break;
            case "n":
              widthDelta = -deltaY * aspectRatio;
              break;
          }
          const newWidth = clamp(startWidth + widthDelta, MIN_WIDTH, maxWidth2);
          const newHeight = newWidth / aspectRatio;
          setDimensions((prev) => __spreadProps(__spreadValues({}, prev), {
            width: newWidth,
            height: newHeight
          }));
        };
        const onPointerUp = (upEvent) => {
          target.releasePointerCapture(upEvent.pointerId);
          document.removeEventListener("pointermove", onPointerMove);
          document.removeEventListener("pointerup", onPointerUp);
          setIsResizing(false);
          setDimensions((current) => {
            commitDimensions(current.width, current.height);
            return current;
          });
        };
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
      },
      [editor, dimensions.width, dimensions.aspectRatio, commitDimensions]
    );
    reactExports.useEffect(() => {
      return b$3(
        editor.registerCommand(
          r$2,
          (event) => {
            var _a;
            if ((_a = containerRef.current) == null ? void 0 : _a.contains(event.target)) {
              const target = event.target;
              if (target.dataset.resizeHandle) return false;
              if (event.shiftKey) {
                setSelected(!isSelected);
              } else {
                clearSelection();
                setSelected(true);
              }
              return true;
            }
            return false;
          },
          Fs
        ),
        editor.registerCommand(
          w$5,
          (e2) => {
            if (isSelected) {
              e2 == null ? void 0 : e2.preventDefault();
              editor.update(() => {
                const node = Se(nodeKey);
                if ($isImageNode(node)) node.remove();
              });
              return true;
            }
            return false;
          },
          Fs
        ),
        editor.registerCommand(
          k$4,
          (e2) => {
            if (isSelected) {
              e2 == null ? void 0 : e2.preventDefault();
              editor.update(() => {
                const node = Se(nodeKey);
                if ($isImageNode(node)) node.remove();
              });
              return true;
            }
            return false;
          },
          Fs
        )
      );
    }, [editor, isSelected, nodeKey, setSelected, clearSelection]);
    const containerClass = [
      "lockin-image-container",
      isSelected && "is-selected",
      isResizing && "is-resizing"
    ].filter(Boolean).join(" ");
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        ref: containerRef,
        className: containerClass,
        style: { width: dimensions.width },
        role: "figure",
        "aria-label": alt || "Image",
        "data-asset-id": assetId != null ? assetId : void 0,
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "img",
            {
              ref: imageRef,
              src,
              alt,
              className: "lockin-image",
              draggable: false,
              onLoad: handleImageLoad
            }
          ),
          isSelected && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "lockin-resize-handle corner nw",
                "data-resize-handle": "nw",
                onPointerDown: (e2) => handleResizeStart(e2, "nw")
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "lockin-resize-handle corner ne",
                "data-resize-handle": "ne",
                onPointerDown: (e2) => handleResizeStart(e2, "ne")
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "lockin-resize-handle corner sw",
                "data-resize-handle": "sw",
                onPointerDown: (e2) => handleResizeStart(e2, "sw")
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "lockin-resize-handle corner se",
                "data-resize-handle": "se",
                onPointerDown: (e2) => handleResizeStart(e2, "se")
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "lockin-resize-handle edge n",
                "data-resize-handle": "n",
                onPointerDown: (e2) => handleResizeStart(e2, "n")
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "lockin-resize-handle edge s",
                "data-resize-handle": "s",
                onPointerDown: (e2) => handleResizeStart(e2, "s")
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "lockin-resize-handle edge e",
                "data-resize-handle": "e",
                onPointerDown: (e2) => handleResizeStart(e2, "e")
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "lockin-resize-handle edge w",
                "data-resize-handle": "w",
                onPointerDown: (e2) => handleResizeStart(e2, "w")
              }
            )
          ] })
        ]
      }
    );
  }
  class ImageNode extends ys {
    constructor(src, alt = "", assetId, width, height, key) {
      super(key);
      __publicField(this, "__src");
      __publicField(this, "__alt");
      __publicField(this, "__assetId");
      __publicField(this, "__width");
      __publicField(this, "__height");
      this.__src = src;
      this.__alt = alt;
      this.__assetId = assetId;
      this.__width = width != null ? width : null;
      this.__height = height != null ? height : null;
    }
    static getType() {
      return "image";
    }
    static clone(node) {
      return new ImageNode(
        node.__src,
        node.__alt,
        node.__assetId,
        node.__width,
        node.__height,
        node.getKey()
      );
    }
    static importJSON(serializedNode) {
      const { src, alt, assetId, width = null, height = null } = serializedNode;
      return new ImageNode(src, alt, assetId, width, height);
    }
    getAssetId() {
      return this.__assetId;
    }
    getWidth() {
      var _a;
      return (_a = this.__width) != null ? _a : null;
    }
    setWidth(width) {
      const self2 = this.getWritable();
      self2.__width = width;
    }
    setHeight(height) {
      const self2 = this.getWritable();
      self2.__height = height;
    }
    exportJSON() {
      var _a, _b;
      return {
        type: "image",
        version: 1,
        src: this.__src,
        alt: this.__alt,
        assetId: this.__assetId,
        width: (_a = this.__width) != null ? _a : null,
        height: (_b = this.__height) != null ? _b : null
      };
    }
    createDOM() {
      const span = document.createElement("span");
      span.className = "lockin-image-wrapper";
      return span;
    }
    updateDOM() {
      return false;
    }
    decorate() {
      return /* @__PURE__ */ jsxRuntimeExports.jsx(
        ResizableImage,
        {
          src: this.__src,
          alt: this.__alt,
          assetId: this.__assetId,
          nodeKey: this.getKey(),
          width: this.__width,
          height: this.__height
        }
      );
    }
  }
  function $createImageNode(params) {
    var _a, _b, _c, _d;
    return new ImageNode(
      params.src,
      (_a = params.alt) != null ? _a : "",
      (_b = params.assetId) != null ? _b : null,
      (_c = params.width) != null ? _c : null,
      (_d = params.height) != null ? _d : null
    );
  }
  function $isImageNode(node) {
    return node instanceof ImageNode;
  }
  const BLOCK_OPTIONS = [
    { value: "paragraph", label: "Paragraph" },
    { value: "h1", label: "Heading 1" },
    { value: "h2", label: "Heading 2" },
    { value: "h3", label: "Heading 3" }
  ];
  const TEXT_COLORS = [
    "#111827",
    "#334155",
    "#2563eb",
    "#7c3aed",
    "#dc2626",
    "#059669",
    "#f59e0b"
  ];
  const HIGHLIGHT_COLORS = [
    "#fef3c7",
    "#e0f2fe",
    "#f3e8ff",
    "#dcfce7",
    "#fee2e2",
    "transparent"
  ];
  const theme = {
    paragraph: "lockin-note-paragraph",
    text: {
      bold: "lockin-note-text-bold",
      italic: "lockin-note-text-italic",
      underline: "lockin-note-text-underline",
      code: "lockin-note-text-code"
    },
    heading: {
      h1: "lockin-note-heading-h1",
      h2: "lockin-note-heading-h2",
      h3: "lockin-note-heading-h3"
    },
    list: {
      ul: "lockin-note-list",
      listitem: "lockin-note-list-item",
      listitemChecked: "lockin-note-list-item-checked",
      listitemUnchecked: "lockin-note-list-item-unchecked",
      olDepth: ["lockin-note-list-ol-depth-1", "lockin-note-list-ol-depth-2"],
      ulDepth: ["lockin-note-list-ul-depth-1", "lockin-note-list-ul-depth-2"]
    },
    code: "lockin-note-code",
    link: "lockin-note-link",
    quote: "lockin-note-quote"
  };
  function relativeLabel$2(iso) {
    if (!iso) return "just now";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "just now";
    const delta = Date.now() - date.getTime();
    const minutes = Math.round(delta / 6e4);
    if (minutes <= 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }
  function NoteContentLoader({
    note,
    onHydrationChange
  }) {
    const [editor] = u$6();
    reactExports.useEffect(() => {
      onHydrationChange == null ? void 0 : onHydrationChange(true);
      const finish = () => {
        window.setTimeout(() => onHydrationChange == null ? void 0 : onHydrationChange(false), 0);
      };
      if (!note || !note.content) {
        finish();
        return;
      }
      const { content } = note;
      if (content.version === "lexical_v1" && content.editorState) {
        finish();
        return;
      }
      if (content.legacyHtml) {
        try {
          const parser = new DOMParser();
          const dom = parser.parseFromString(content.legacyHtml, "text/html");
          const nodes = p$3(editor, dom);
          editor.update(() => {
            const root = we();
            root.clear();
            root.append(...nodes);
          });
        } catch (e2) {
        }
      }
      finish();
    }, [editor, note, onHydrationChange]);
    return null;
  }
  function NoteChangePlugin({
    onChange,
    isHydrating
  }) {
    const isFirstChangeRef = reactExports.useRef(true);
    reactExports.useEffect(() => {
      isFirstChangeRef.current = true;
    }, []);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      i,
      {
        ignoreSelectionChange: true,
        onChange: (editorState) => {
          if (isFirstChangeRef.current) {
            isFirstChangeRef.current = false;
            return;
          }
          if (isHydrating) {
            return;
          }
          const plainText = editorState.read(() => we().getTextContent());
          onChange({
            version: "lexical_v1",
            editorState: editorState.toJSON(),
            plainText
          });
        }
      }
    );
  }
  function CaretScrollPlugin({
    topRatio = 0.15,
    bottomRatio = 0.85,
    scrollCushion = 24,
    smoothThreshold = 150
  }) {
    const [editor] = u$6();
    const prefersReducedMotion = reactExports.useRef(false);
    const lastScrollTime = reactExports.useRef(0);
    reactExports.useEffect(() => {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      prefersReducedMotion.current = mediaQuery.matches;
      const handler = (e2) => {
        prefersReducedMotion.current = e2.matches;
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }, []);
    reactExports.useEffect(() => {
      const scrollToCaret = () => {
        const rootElement = editor.getRootElement();
        if (!rootElement) return;
        const scrollContainer = rootElement.closest(
          ".lockin-note-editor-scroll"
        );
        if (!scrollContainer) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (!range.collapsed) return;
        const caretRect = range.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        if (caretRect.height === 0 && caretRect.width === 0) return;
        const containerHeight = containerRect.height;
        const topBand = containerRect.top + containerHeight * topRatio;
        const bottomBand = containerRect.top + containerHeight * bottomRatio;
        const caretY = caretRect.top;
        const caretBottom = caretRect.bottom;
        if (caretY >= topBand && caretBottom <= bottomBand) {
          return;
        }
        let scrollDelta = 0;
        if (caretY < topBand) {
          scrollDelta = caretY - topBand - scrollCushion;
        } else if (caretBottom > bottomBand) {
          scrollDelta = caretBottom - bottomBand + scrollCushion;
        }
        if (Math.abs(scrollDelta) < 4) return;
        const now = Date.now();
        if (now - lastScrollTime.current < 50) return;
        lastScrollTime.current = now;
        const useSmooth = !prefersReducedMotion.current && Math.abs(scrollDelta) > smoothThreshold;
        scrollContainer.scrollBy({
          top: scrollDelta,
          behavior: useSmooth ? "smooth" : "auto"
        });
      };
      let rafId = null;
      const debouncedScroll = () => {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          scrollToCaret();
        });
      };
      const unregister = editor.registerCommand(
        e,
        () => {
          debouncedScroll();
          return false;
        },
        Fs
      );
      const unregisterKey = editor.registerCommand(
        _$3,
        () => {
          window.setTimeout(debouncedScroll, 0);
          return false;
        },
        Fs
      );
      return () => {
        unregister();
        unregisterKey();
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
      };
    }, [editor, topRatio, bottomRatio, scrollCushion, smoothThreshold]);
    return null;
  }
  function ShortcutsPlugin({ onSaveNow }) {
    const [editor] = u$6();
    reactExports.useEffect(() => {
      return editor.registerCommand(
        _$3,
        (event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            onSaveNow == null ? void 0 : onSaveNow();
            return true;
          }
          return false;
        },
        Fs
      );
    }, [editor, onSaveNow]);
    return null;
  }
  function insertAssetIntoEditor(editor, asset) {
    editor.update(() => {
      var _a, _b, _c;
      const selection = Oi();
      const root = we();
      if (!selection || !yi(selection)) {
        root.selectEnd();
      }
      const rootChildren = root.getChildren();
      if (rootChildren.length === 0) {
        const paragraph = Ns();
        root.append(paragraph);
        paragraph.selectEnd();
      }
      const rootElement = editor.getRootElement();
      const containerWidth = (_b = (_a = rootElement == null ? void 0 : rootElement.parentElement) == null ? void 0 : _a.getBoundingClientRect().width) != null ? _b : null;
      const defaultWidth = containerWidth ? Math.max(220, Math.min(containerWidth - 24, 640)) : null;
      if (((_c = asset.mimeType) == null ? void 0 : _c.startsWith("image/")) || asset.type === "image") {
        const node = $createImageNode({
          src: asset.url,
          alt: asset.fileName || asset.mimeType || "image",
          assetId: asset.id,
          width: defaultWidth
        });
        Ri([node]);
      } else {
        const node = $createAttachmentNode({
          assetId: asset.id,
          href: asset.url,
          fileName: asset.fileName || "attachment",
          mimeType: asset.mimeType
        });
        Ri([node]);
      }
    });
  }
  function UploadPlugin({
    onUploadFile,
    onEditorReady
  }) {
    const [editor] = u$6();
    reactExports.useEffect(() => {
      onEditorReady == null ? void 0 : onEditorReady(editor);
    }, [editor, onEditorReady]);
    const handleFiles = reactExports.useCallback(
      (files) => __async(null, null, function* () {
        if (!onUploadFile || !files || files.length === 0) return;
        const file = files[0];
        const asset = yield onUploadFile(file);
        if (!asset) return;
        insertAssetIntoEditor(editor, asset);
      }),
      [editor, onUploadFile]
    );
    reactExports.useEffect(() => {
      if (!onUploadFile) return;
      const listener = (event) => {
        var _a, _b;
        const files = event instanceof ClipboardEvent ? (_a = event.clipboardData) == null ? void 0 : _a.files : event instanceof DragEvent ? (_b = event.dataTransfer) == null ? void 0 : _b.files : null;
        if (!files || files.length === 0) return;
        event.preventDefault();
        void handleFiles(files);
      };
      const rootElement = editor.getRootElement();
      if (!rootElement) return;
      rootElement.addEventListener("paste", listener);
      rootElement.addEventListener("drop", listener);
      return () => {
        rootElement.removeEventListener("paste", listener);
        rootElement.removeEventListener("drop", listener);
      };
    }, [editor, handleFiles, onUploadFile]);
    return null;
  }
  function AssetCleanupPlugin({
    noteId,
    onDeleteAsset,
    isHydrating
  }) {
    const [editor] = u$6();
    const assetKeyMapRef = reactExports.useRef(/* @__PURE__ */ new Map());
    reactExports.useEffect(() => {
      assetKeyMapRef.current.clear();
      if (!onDeleteAsset || isHydrating) return;
      editor.getEditorState().read(() => {
        qe(ImageNode).forEach((node) => {
          const assetId = node.getAssetId();
          if (assetId) {
            assetKeyMapRef.current.set(node.getKey(), assetId);
          }
        });
        qe(AttachmentNode).forEach((node) => {
          const assetId = node.getAssetId();
          if (assetId) {
            assetKeyMapRef.current.set(node.getKey(), assetId);
          }
        });
      });
    }, [editor, isHydrating, noteId, onDeleteAsset]);
    reactExports.useEffect(() => {
      if (!onDeleteAsset) return;
      const handleMutations = (mutations) => {
        if (isHydrating) return;
        mutations.forEach((mutation, nodeKey) => {
          if (mutation === "created") {
            editor.getEditorState().read(() => {
              var _a;
              const node = Se(nodeKey);
              if (!node) return;
              if ($isImageNode(node) || $isAttachmentNode(node)) {
                const assetId = (_a = node.getAssetId) == null ? void 0 : _a.call(node);
                if (assetId) {
                  assetKeyMapRef.current.set(nodeKey, assetId);
                }
              }
            });
          } else if (mutation === "destroyed") {
            const assetId = assetKeyMapRef.current.get(nodeKey);
            if (assetId) {
              assetKeyMapRef.current.delete(nodeKey);
              void onDeleteAsset(assetId);
            }
          }
        });
      };
      return b$3(
        editor.registerMutationListener(ImageNode, handleMutations),
        editor.registerMutationListener(AttachmentNode, handleMutations)
      );
    }, [editor, isHydrating, onDeleteAsset]);
    return null;
  }
  function Tooltip({
    text,
    children
  }) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "lockin-tooltip-wrapper", children: [
      children,
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-tooltip", role: "tooltip", children: text })
    ] });
  }
  function ToolbarButton({
    label,
    onClick,
    active,
    disabled,
    children,
    swatchColor
  }) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Tooltip, { text: label, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        type: "button",
        className: `lockin-note-tool-btn${active ? " is-active" : ""}`,
        "aria-pressed": active,
        "aria-label": label,
        disabled,
        onClick,
        children: [
          children || label,
          swatchColor && /* @__PURE__ */ jsxRuntimeExports.jsx(
            "span",
            {
              className: "lockin-tool-swatch",
              style: {
                background: swatchColor === "transparent" ? "linear-gradient(135deg, #fff 45%, #f00 50%, #fff 55%)" : swatchColor
              }
            }
          )
        ]
      }
    ) });
  }
  function BlockTypeSelect({
    value,
    onChange
  }) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "select",
      {
        className: "lockin-note-block-select",
        value,
        onChange: (event) => onChange(event.target.value),
        "aria-label": "Block type",
        children: BLOCK_OPTIONS.map((option) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: option.value, children: option.label }, option.value))
      }
    );
  }
  function SwatchMenu({
    swatches,
    onSelect,
    label
  }) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-color-menu", role: "listbox", "aria-label": label, children: swatches.map((color) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        className: "lockin-color-swatch",
        style: { background: color === "transparent" ? "white" : color },
        onClick: () => onSelect(color),
        "aria-label": `${label} ${color}`
      },
      color
    )) });
  }
  function NoteToolbar({
    onOpenFilePicker,
    disableAttachment,
    isUploading
  }) {
    const [editor] = u$6();
    const [blockType, setBlockTypeState] = reactExports.useState("paragraph");
    const [selectionFormats, setSelectionFormats] = reactExports.useState(
      /* @__PURE__ */ new Set()
    );
    const [alignment, setAlignment] = reactExports.useState("left");
    const [showColor, setShowColor] = reactExports.useState(false);
    const [showHighlight, setShowHighlight] = reactExports.useState(false);
    const [currentTextColor, setCurrentTextColor] = reactExports.useState(
      TEXT_COLORS[0]
    );
    const [currentHighlight, setCurrentHighlight] = reactExports.useState("transparent");
    const updateToolbar = reactExports.useCallback(() => {
      editor.getEditorState().read(() => {
        const selection = Oi();
        if (!yi(selection)) return;
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getKey() === "root" ? anchorNode : anchorNode.getTopLevelElementOrThrow();
        const formats = /* @__PURE__ */ new Set();
        if (selection.hasFormat("bold")) formats.add("bold");
        if (selection.hasFormat("italic")) formats.add("italic");
        if (selection.hasFormat("underline")) formats.add("underline");
        if (selection.hasFormat("code")) formats.add("code");
        setSelectionFormats(formats);
        if (Et(element)) {
          setBlockTypeState(element.getTag());
        } else if ($(element)) {
          setBlockTypeState("paragraph");
        } else {
          const type = element.getType();
          setBlockTypeState(type === "paragraph" ? "paragraph" : "paragraph");
        }
        if (_s(element)) {
          const formatType = element.getFormatType();
          setAlignment(formatType || "left");
        } else {
          setAlignment("left");
        }
      });
    }, [editor]);
    reactExports.useEffect(() => {
      return b$3(
        editor.registerUpdateListener(
          ({ editorState }) => {
            editorState.read(() => updateToolbar());
          }
        ),
        editor.registerCommand(
          e,
          () => {
            updateToolbar();
            return false;
          },
          Fs
        )
      );
    }, [editor, updateToolbar]);
    const applyStyle = reactExports.useCallback(
      (style) => {
        editor.update(() => {
          const selection = Oi();
          if (yi(selection)) {
            B$2(selection, style);
          }
        });
      },
      [editor]
    );
    const handleBlockChange = (next) => {
      setBlockTypeState(next);
      editor.update(() => {
        const selection = Oi();
        if (yi(selection)) {
          if (next === "paragraph") {
            k$3(selection, () => Ns());
          } else {
            k$3(selection, () => wt(next));
          }
        }
      });
    };
    const toggleLink = reactExports.useCallback(() => {
      const url = window.prompt("Enter URL");
      if (url) {
        editor.dispatchCommand(p$5, url);
      } else {
        editor.dispatchCommand(p$5, null);
      }
    }, [editor]);
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-note-toolbar", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-toolbar-group", children: /* @__PURE__ */ jsxRuntimeExports.jsx(BlockTypeSelect, { value: blockType, onChange: handleBlockChange }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-toolbar-divider" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-note-toolbar-group", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Bold",
            active: selectionFormats.has("bold"),
            onClick: () => editor.dispatchCommand(d$3, "bold"),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Bold, { size: 16, strokeWidth: 2.5 })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Italic",
            active: selectionFormats.has("italic"),
            onClick: () => editor.dispatchCommand(d$3, "italic"),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Italic, { size: 16, strokeWidth: 2.5 })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Underline",
            active: selectionFormats.has("underline"),
            onClick: () => editor.dispatchCommand(d$3, "underline"),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Underline, { size: 16, strokeWidth: 2.5 })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Inline code",
            active: selectionFormats.has("code"),
            onClick: () => editor.dispatchCommand(d$3, "code"),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Code, { size: 16, strokeWidth: 2.5 })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(ToolbarButton, { label: "Link", onClick: toggleLink, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { size: 16, strokeWidth: 2.5 }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-toolbar-divider" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-note-toolbar-group lockin-note-toolbar-menu", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Text color",
            onClick: () => setShowColor((v2) => !v2),
            swatchColor: currentTextColor,
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Palette, { size: 16, strokeWidth: 2.5 })
          }
        ),
        showColor ? /* @__PURE__ */ jsxRuntimeExports.jsx(
          SwatchMenu,
          {
            label: "Text color",
            swatches: TEXT_COLORS,
            onSelect: (color) => {
              applyStyle({ color });
              setCurrentTextColor(color);
              setShowColor(false);
            }
          }
        ) : null,
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Highlight",
            onClick: () => setShowHighlight((v2) => !v2),
            swatchColor: currentHighlight,
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Highlighter, { size: 16, strokeWidth: 2.5 })
          }
        ),
        showHighlight ? /* @__PURE__ */ jsxRuntimeExports.jsx(
          SwatchMenu,
          {
            label: "Highlight",
            swatches: HIGHLIGHT_COLORS,
            onSelect: (color) => {
              if (color === "transparent") {
                applyStyle({ "background-color": "transparent" });
              } else {
                applyStyle({ "background-color": color });
              }
              setCurrentHighlight(color);
              setShowHighlight(false);
            }
          }
        ) : null
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-toolbar-divider" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-note-toolbar-group", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Bulleted list",
            onClick: () => editor.dispatchCommand(j, void 0),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(List, { size: 16, strokeWidth: 2.5 })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Numbered list",
            onClick: () => editor.dispatchCommand(q, void 0),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(ListOrdered, { size: 16, strokeWidth: 2.5 })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Code block",
            onClick: () => {
              editor.update(() => {
                const selection = Oi();
                if (yi(selection)) {
                  k$3(selection, () => H());
                }
              });
            },
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Braces, { size: 16, strokeWidth: 2.5 })
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-toolbar-divider" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-note-toolbar-group", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Align left",
            active: alignment === "left" || alignment === "start",
            onClick: () => editor.dispatchCommand(L$4, "left"),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(TextAlignStart, { size: 16, strokeWidth: 2.5 })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Align center",
            active: alignment === "center",
            onClick: () => editor.dispatchCommand(L$4, "center"),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(TextAlignCenter, { size: 16, strokeWidth: 2.5 })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Align right",
            active: alignment === "right" || alignment === "end",
            onClick: () => editor.dispatchCommand(L$4, "right"),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(TextAlignEnd, { size: 16, strokeWidth: 2.5 })
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-toolbar-divider" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-note-toolbar-group", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Attach file",
            onClick: onOpenFilePicker,
            disabled: disableAttachment,
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Paperclip, { size: 16, strokeWidth: 2.5 })
          }
        ),
        isUploading ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-inline-spinner", "aria-label": "Uploading" }) : null
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-toolbar-divider" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-note-toolbar-group", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Undo",
            onClick: () => editor.dispatchCommand(h$5, void 0),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Undo2, { size: 16, strokeWidth: 2.5 })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          ToolbarButton,
          {
            label: "Redo",
            onClick: () => editor.dispatchCommand(g$6, void 0),
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Redo2, { size: 16, strokeWidth: 2.5 })
          }
        )
      ] })
    ] });
  }
  function buildStatusLabel({
    status,
    updatedAt,
    isAssetUploading,
    error
  }) {
    if (error) {
      return {
        label: error || "Error saving - retry soon",
        tone: "error",
        spinner: false
      };
    }
    if (status === "error") {
      return {
        label: "Error saving - retry soon",
        tone: "error",
        spinner: false
      };
    }
    if (status === "saving") {
      return { label: "Saving...", tone: "muted", spinner: true };
    }
    if (isAssetUploading) {
      return {
        label: "Uploading attachment...",
        tone: "muted",
        spinner: true
      };
    }
    if (status === "saved") {
      return {
        label: `Saved ${relativeLabel$2(updatedAt)}`,
        tone: "success",
        spinner: false
      };
    }
    if (status === "editing") {
      return { label: "Editing...", tone: "muted", spinner: false };
    }
    return { label: "Idle", tone: "muted", spinner: false };
  }
  function NoteEditorShell({
    note,
    status,
    title,
    onTitleChange,
    onContentChange,
    onSaveNow,
    onUploadFile,
    onDeleteAsset,
    isAssetUploading,
    assetError,
    editorError
  }) {
    var _a, _b;
    const fileInputRef = reactExports.useRef(null);
    const [composerEditor, setComposerEditor] = reactExports.useState(
      null
    );
    const [isHydrating, setIsHydrating] = reactExports.useState(false);
    const composerKey = (_a = note == null ? void 0 : note.id) != null ? _a : "new-note";
    const initialEditorState = reactExports.useMemo(() => {
      if (!(note == null ? void 0 : note.content)) return null;
      if (note.content.version === "lexical_v1" && note.content.editorState) {
        const state = note.content.editorState;
        if (typeof state === "string") return state;
        try {
          return JSON.stringify(state);
        } catch (e2) {
          return null;
        }
      }
      return null;
    }, [note == null ? void 0 : note.id, (_b = note == null ? void 0 : note.content) == null ? void 0 : _b.editorState]);
    const initialConfig = reactExports.useMemo(
      () => ({
        namespace: "LockInNoteEditor",
        theme,
        editorState: initialEditorState,
        editable: true,
        onError(error) {
          console.error("Lexical editor error", error);
        },
        nodes: [
          yt,
          K,
          M$2,
          o$4,
          pt,
          M$3,
          X,
          ImageNode,
          AttachmentNode
        ]
      }),
      [initialEditorState]
    );
    const statusMeta = buildStatusLabel({
      status,
      updatedAt: note == null ? void 0 : note.updatedAt,
      isAssetUploading,
      error: assetError || editorError
    });
    const handleUploadClick = reactExports.useCallback(() => {
      var _a2;
      (_a2 = fileInputRef.current) == null ? void 0 : _a2.click();
    }, []);
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-note-shell-card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-note-shell-head", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            className: "lockin-note-title-input",
            value: title,
            placeholder: "Note title...",
            onChange: (e2) => onTitleChange(e2.target.value)
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `lockin-note-status is-${statusMeta.tone}`, children: [
          statusMeta.spinner ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-inline-spinner", "aria-hidden": "true" }) : null,
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: statusMeta.label })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(p$2, { initialConfig, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          NoteToolbar,
          {
            onOpenFilePicker: onUploadFile ? handleUploadClick : void 0,
            disableAttachment: !(note == null ? void 0 : note.id) || !onUploadFile,
            isUploading: isAssetUploading
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-editor-surface", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-editor-scroll", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          h,
          {
            contentEditable: /* @__PURE__ */ jsxRuntimeExports.jsx(
              x$1,
              {
                className: "lockin-note-editor-area",
                "data-placeholder": "Write your note here..."
              }
            ),
            placeholder: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-placeholder", children: "Write your note here..." }),
            ErrorBoundary: a
          }
        ) }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(a$2, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(u$5, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(u$2, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(o, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(NoteContentLoader, { note, onHydrationChange: setIsHydrating }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          NoteChangePlugin,
          {
            onChange: onContentChange,
            isHydrating
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(ShortcutsPlugin, { onSaveNow }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(CaretScrollPlugin, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          UploadPlugin,
          {
            onUploadFile,
            onEditorReady: setComposerEditor
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          AssetCleanupPlugin,
          {
            noteId: note == null ? void 0 : note.id,
            onDeleteAsset,
            isHydrating
          }
        )
      ] }, composerKey),
      assetError ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-inline-error", children: assetError }) : null,
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          ref: fileInputRef,
          type: "file",
          accept: "*/*",
          style: { display: "none" },
          onChange: (event) => {
            var _a2;
            const file = (_a2 = event.target.files) == null ? void 0 : _a2[0];
            if (file && onUploadFile && composerEditor) {
              void onUploadFile(file).then((asset) => {
                if (asset) {
                  insertAssetIntoEditor(composerEditor, asset);
                }
              });
            }
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }
        }
      )
    ] });
  }
  const NoteEditor = NoteEditorShell;
  function relativeLabel$1(iso) {
    if (!iso) return "just now";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "just now";
    const delta = Date.now() - date.getTime();
    const minutes = Math.round(delta / 6e4);
    if (minutes <= 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }
  function formatLinkedLabel(week) {
    if (week != null && week > 0) {
      return `Week ${week}`;
    }
    return null;
  }
  function NotesPanel({
    notesService,
    notes,
    notesLoading,
    onRefreshNotes,
    onNoteSaved,
    onDeleteNote,
    onToggleStar,
    activeNoteId,
    onSelectNote,
    courseCode,
    pageUrl,
    currentWeek,
    onNoteEditingChange
  }) {
    var _a, _b;
    const [view, setView] = reactExports.useState("current");
    const [filter, setFilter] = reactExports.useState("course");
    const [search, setSearch] = reactExports.useState("");
    const [isDeleting, setIsDeleting] = reactExports.useState(null);
    const [deleteError, setDeleteError] = reactExports.useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = reactExports.useState(null);
    const [noteToDeleteTitle, setNoteToDeleteTitle] = reactExports.useState("");
    const { toast, showToast, hideToast } = useToast();
    const hasValidWeek = currentWeek != null && currentWeek > 0;
    const effectiveSourceUrl = hasValidWeek ? pageUrl : null;
    const {
      note,
      status,
      error: editorError,
      activeNoteId: editorActiveId,
      handleContentChange,
      handleTitleChange,
      saveNow,
      resetToNew
    } = useNoteEditor({
      noteId: activeNoteId,
      notesService,
      defaultCourseCode: courseCode,
      defaultSourceUrl: effectiveSourceUrl
    });
    const prevEditorActiveIdRef = reactExports.useRef(editorActiveId);
    reactExports.useEffect(() => {
      if (editorActiveId !== prevEditorActiveIdRef.current && editorActiveId !== activeNoteId && editorActiveId !== null) {
        onSelectNote(editorActiveId);
      }
      prevEditorActiveIdRef.current = editorActiveId;
    }, [editorActiveId, activeNoteId, onSelectNote]);
    reactExports.useEffect(() => {
      if (status === "saved" && note) {
        onNoteSaved(note);
      }
    }, [note, onNoteSaved, status]);
    reactExports.useEffect(() => {
      const isEditing = status === "editing" || status === "saving";
      if (isEditing) {
        onNoteEditingChange == null ? void 0 : onNoteEditingChange(true);
        return;
      }
      const timeout = window.setTimeout(() => {
        onNoteEditingChange == null ? void 0 : onNoteEditingChange(false);
      }, 3e3);
      return () => window.clearTimeout(timeout);
    }, [onNoteEditingChange, status]);
    const {
      isUploading: isAssetUploading,
      error: noteAssetError,
      uploadAsset,
      deleteAsset
    } = useNoteAssets(editorActiveId, notesService);
    const currentNoteFromList = reactExports.useMemo(() => {
      if (!editorActiveId) return null;
      return notes.find((n2) => n2.id === editorActiveId) || null;
    }, [editorActiveId, notes]);
    const isCurrentNoteStarred = (_b = (_a = currentNoteFromList == null ? void 0 : currentNoteFromList.isStarred) != null ? _a : note == null ? void 0 : note.isStarred) != null ? _b : false;
    const filteredNotes = reactExports.useMemo(() => {
      const searchTerm = search.trim().toLowerCase();
      return notes.filter((item) => {
        var _a2;
        let matchesFilter = false;
        if (filter === "all") {
          matchesFilter = true;
        } else if (filter === "course") {
          if (courseCode != null) {
            matchesFilter = item.courseCode === courseCode;
          } else {
            matchesFilter = item.courseCode == null;
          }
        } else if (filter === "starred") {
          matchesFilter = item.isStarred === true;
        }
        const preview = item.previewText || ((_a2 = item.content) == null ? void 0 : _a2.plainText) || "";
        const matchesSearch = !searchTerm || item.title.toLowerCase().includes(searchTerm) || preview.toLowerCase().includes(searchTerm);
        return matchesFilter && matchesSearch;
      });
    }, [courseCode, filter, notes, search]);
    const handleNewNote = reactExports.useCallback(() => {
      resetToNew();
      onSelectNote(null);
      setView("current");
    }, [resetToNew, onSelectNote]);
    const handleSelectNote = reactExports.useCallback(
      (noteId) => {
        onSelectNote(noteId);
        setView("current");
      },
      [onSelectNote]
    );
    const openDeleteConfirm = reactExports.useCallback(
      (noteId, noteTitle, e2) => {
        e2.stopPropagation();
        setDeleteConfirmId(noteId);
        setNoteToDeleteTitle(noteTitle || "Untitled");
      },
      []
    );
    const closeDeleteConfirm = reactExports.useCallback(() => {
      setDeleteConfirmId(null);
      setNoteToDeleteTitle("");
    }, []);
    const executeDelete = reactExports.useCallback(() => __async(null, null, function* () {
      if (!deleteConfirmId || isDeleting) return;
      setIsDeleting(deleteConfirmId);
      setDeleteError(null);
      try {
        yield onDeleteNote(deleteConfirmId);
        if (view === "current" && editorActiveId === deleteConfirmId) {
          resetToNew();
          setView("all");
        }
        showToast("Note deleted successfully", "success");
      } catch (err) {
        setDeleteError((err == null ? void 0 : err.message) || "Failed to delete note");
        showToast("Failed to delete note", "error");
      } finally {
        setIsDeleting(null);
        closeDeleteConfirm();
      }
    }), [
      deleteConfirmId,
      isDeleting,
      onDeleteNote,
      view,
      editorActiveId,
      resetToNew,
      showToast,
      closeDeleteConfirm
    ]);
    const handleToggleStar = reactExports.useCallback(
      (noteId, e2) => __async(null, null, function* () {
        e2.stopPropagation();
        try {
          const updatedNote = yield onToggleStar(noteId);
          if (updatedNote && editorActiveId === noteId) {
            onNoteSaved(updatedNote);
          }
          if (updatedNote == null ? void 0 : updatedNote.isStarred) {
            showToast("Note starred", "star");
          } else {
            showToast("Note unstarred", "info");
          }
        } catch (err) {
          let errorMessage = "Failed to update star status";
          if ((err == null ? void 0 : err.code) === "AUTH_REQUIRED") {
            errorMessage = "Please sign in to star notes";
          } else if ((err == null ? void 0 : err.code) === "NOT_FOUND") {
            errorMessage = "Note not found";
          } else if ((err == null ? void 0 : err.code) === "NETWORK_ERROR") {
            errorMessage = "Network error. Check your connection.";
          } else if ((err == null ? void 0 : err.message) && err.message.length < 60) {
            errorMessage = err.message;
          }
          showToast(errorMessage, "error");
          console.error("[Lock-in] Toggle star failed:", err);
        }
      }),
      [onToggleStar, editorActiveId, onNoteSaved, showToast]
    );
    const weekLabel = formatLinkedLabel(currentWeek);
    const linkedTarget = weekLabel ? (note == null ? void 0 : note.sourceUrl) || pageUrl : null;
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-panel", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "lockin-notes-header lockin-notes-header-row", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-header-left", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-course-row", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-notes-label", children: "Course:" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { className: "lockin-notes-course-value", children: courseCode || "None" })
          ] }),
          weekLabel && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-link-row", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-notes-label", children: "Linked to:" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "a",
              {
                href: linkedTarget || "#",
                target: "_blank",
                rel: "noreferrer",
                className: "lockin-notes-link-href",
                children: weekLabel
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-notes-header-center", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-toggle", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: `lockin-notes-toggle-btn${view === "current" ? " is-active" : ""}`,
              onClick: () => setView("current"),
              children: "Current"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: `lockin-notes-toggle-btn${view === "all" ? " is-active" : ""}`,
              onClick: () => setView("all"),
              children: "All notes"
            }
          )
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-header-right", children: [
          view === "current" && editorActiveId && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-header-actions", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                className: `lockin-note-action-btn lockin-note-star-btn${isCurrentNoteStarred ? " is-starred" : ""}`,
                onClick: (e2) => handleToggleStar(editorActiveId, e2),
                title: isCurrentNoteStarred ? "Unstar note" : "Star note",
                "aria-label": isCurrentNoteStarred ? "Unstar note" : "Star note",
                children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Star,
                  {
                    size: 16,
                    strokeWidth: 2,
                    fill: isCurrentNoteStarred ? "currentColor" : "none"
                  }
                )
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                className: "lockin-note-action-btn lockin-note-delete-btn",
                onClick: (e2) => openDeleteConfirm(editorActiveId, (note == null ? void 0 : note.title) || "", e2),
                disabled: isDeleting === editorActiveId,
                title: "Delete note",
                "aria-label": "Delete note",
                children: isDeleting === editorActiveId ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-inline-spinner", "aria-hidden": "true" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { size: 16, strokeWidth: 2 })
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              className: "lockin-btn-primary",
              onClick: handleNewNote,
              children: "+ New note"
            }
          )
        ] })
      ] }),
      deleteError && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-error", children: [
        deleteError,
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            className: "lockin-notes-error-dismiss",
            onClick: () => setDeleteError(null),
            children: "\u00d7"
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-body", children: [
        view === "current" && /* @__PURE__ */ jsxRuntimeExports.jsx(
          NoteEditor,
          {
            note,
            status,
            title: (note == null ? void 0 : note.title) || "",
            onTitleChange: handleTitleChange,
            onContentChange: handleContentChange,
            onSaveNow: saveNow,
            onUploadFile: uploadAsset,
            onDeleteAsset: deleteAsset,
            isAssetUploading,
            assetError: noteAssetError,
            editorError
          }
        ),
        view === "all" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-list-container", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-filter-bar", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-filter-group", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-notes-filter-label", children: "Filter" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "select",
                {
                  className: "lockin-notes-filter-select",
                  value: filter,
                  onChange: (e2) => setFilter(e2.target.value),
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "course", children: "This course" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "all", children: "All notes" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "starred", children: "Starred" })
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                className: "lockin-notes-search-input",
                placeholder: "Search notes",
                value: search,
                onChange: (e2) => setSearch(e2.target.value)
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                className: "lockin-btn-ghost",
                onClick: onRefreshNotes,
                children: "Refresh"
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-notes-list", children: notesLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-notes-empty", children: "Loading notes..." }) : filteredNotes.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-notes-empty", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-notes-empty-title", children: "No notes yet" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-notes-empty-subtitle", children: "Capture a note from the current page to see it here." }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                className: "lockin-btn-ghost lockin-notes-empty-btn",
                onClick: () => setView("current"),
                children: "Create a note"
              }
            )
          ] }) : filteredNotes.map((item) => {
            var _a2;
            return /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                className: `lockin-note-card${item.id && item.id === editorActiveId ? " is-active" : ""}${item.isStarred ? " is-starred" : ""}`,
                onClick: () => handleSelectNote(item.id || null),
                role: "button",
                tabIndex: 0,
                onKeyDown: (e2) => {
                  if (e2.key === "Enter" || e2.key === " ") {
                    handleSelectNote(item.id || null);
                  }
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-note-card-header", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-note-card-title-row", children: [
                      item.isStarred && /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Star,
                        {
                          className: "lockin-note-star-indicator",
                          size: 14,
                          strokeWidth: 2,
                          fill: "currentColor",
                          "aria-label": "Starred"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-card-title", children: item.title || "Untitled" })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-card-actions", children: item.id && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          type: "button",
                          className: `lockin-note-action-btn lockin-note-star-btn${item.isStarred ? " is-starred" : ""}`,
                          onClick: (e2) => handleToggleStar(item.id, e2),
                          title: item.isStarred ? "Unstar note" : "Star note",
                          "aria-label": item.isStarred ? "Unstar note" : "Star note",
                          children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                            Star,
                            {
                              size: 14,
                              strokeWidth: 2,
                              fill: item.isStarred ? "currentColor" : "none"
                            }
                          )
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          type: "button",
                          className: "lockin-note-action-btn lockin-note-delete-btn",
                          onClick: (e2) => openDeleteConfirm(
                            item.id,
                            item.title || "Untitled",
                            e2
                          ),
                          disabled: isDeleting === item.id,
                          title: "Delete note",
                          "aria-label": "Delete note",
                          children: isDeleting === item.id ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                            "span",
                            {
                              className: "lockin-inline-spinner",
                              "aria-hidden": "true"
                            }
                          ) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { size: 14, strokeWidth: 2 })
                        }
                      )
                    ] }) })
                  ] }),
                  item.courseCode && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-note-badge", children: item.courseCode }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-note-card-snippet", children: item.previewText || ((_a2 = item.content) == null ? void 0 : _a2.plainText) || "No content" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-note-card-meta", children: [
                    "Updated ",
                    relativeLabel$1(item.updatedAt || item.createdAt)
                  ] })
                ]
              },
              item.id || item.title
            );
          }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ConfirmDialog,
        {
          isOpen: deleteConfirmId !== null,
          onClose: closeDeleteConfirm,
          onConfirm: executeDelete,
          title: "Delete Note",
          description: `Are you sure you want to delete "${noteToDeleteTitle}"? This action cannot be undone.`,
          confirmLabel: "Delete",
          cancelLabel: "Cancel",
          variant: "danger",
          isLoading: isDeleting !== null
        }
      ),
      toast && /* @__PURE__ */ jsxRuntimeExports.jsx(
        Toast,
        {
          message: toast.message,
          type: toast.type,
          isVisible: toast.isVisible,
          onDismiss: hideToast
        }
      )
    ] });
  }
  function createNoteContentFromPlainText(text) {
    const normalized = text || "";
    const textNode = normalized ? [
      {
        detail: 0,
        format: 0,
        mode: "normal",
        style: "",
        text: normalized,
        type: "text",
        version: 1
      }
    ] : [];
    return {
      version: "lexical_v1",
      editorState: {
        root: {
          children: [
            {
              children: textNode,
              direction: "ltr",
              format: "",
              indent: 0,
              type: "paragraph",
              version: 1
            }
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "root",
          version: 1
        }
      },
      legacyHtml: null,
      plainText: normalized
    };
  }
  function ProviderBadge({ provider }) {
    const badgeColors = {
      panopto: { bg: "#1e3a5f", text: "#ffffff" },
      echo360: { bg: "#0066cc", text: "#ffffff" },
      youtube: { bg: "#cc0000", text: "#ffffff" },
      unknown: { bg: "#6b7280", text: "#ffffff" }
    };
    const colors = badgeColors[provider] || badgeColors.unknown;
    const labelMap = {
      panopto: "Panopto",
      echo360: "Echo360",
      youtube: "YouTube",
      unknown: "Unknown"
    };
    const label = labelMap[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "span",
      {
        className: "lockin-video-provider-badge",
        style: { backgroundColor: colors.bg, color: colors.text },
        children: label
      }
    );
  }
  function VideoListItem({
    video,
    isExtracting,
    onSelect
  }) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        className: `lockin-video-item ${isExtracting ? "is-extracting" : ""}`,
        onClick: onSelect,
        disabled: isExtracting,
        type: "button",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-video-item-content", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-video-item-header", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(ProviderBadge, { provider: video.provider }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-video-item-title", children: video.title })
            ] }),
            video.thumbnailUrl && /* @__PURE__ */ jsxRuntimeExports.jsx(
              "img",
              {
                src: video.thumbnailUrl,
                alt: "",
                className: "lockin-video-thumbnail"
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-video-item-action", children: isExtracting ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-inline-spinner" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-video-extract-icon", children: "\u2192" }) })
        ]
      }
    );
  }
  function VideoListPanel({
    videos,
    isLoading,
    isExtracting: _isExtracting,
    extractingVideoId,
    onSelectVideo,
    onClose,
    error
  }) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-video-list-panel", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-video-list-header", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "lockin-video-list-title", children: "Select a video" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "lockin-video-list-close",
            onClick: onClose,
            "aria-label": "Close",
            type: "button",
            children: "\u00d7"
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-video-list-body", children: isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-video-list-loading", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-inline-spinner" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Detecting videos..." })
      ] }) : error ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-video-list-error", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: error }) }) : videos.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-video-list-empty", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "No videos detected on this page." }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "lockin-video-list-hint", children: "Supported: Panopto, Echo360" })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-video-list", children: videos.map((video) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        VideoListItem,
        {
          video,
          isExtracting: extractingVideoId === video.id,
          onSelect: () => onSelectVideo(video)
        },
        `${video.provider}-${video.id}`
      )) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-video-list-footer", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "lockin-video-list-info", children: [
        videos.length,
        " video",
        videos.length !== 1 ? "s" : "",
        " found"
      ] }) })
    ] });
  }
  function formatTime(ms2) {
    const totalSeconds = Math.floor(ms2 / 1e3);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  function formatAsPlainText(transcript, title) {
    const lines = [];
    lines.push(`Transcript: ${title}`);
    lines.push(`Duration: ${formatTime(transcript.durationMs || 0)}`);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(transcript.plainText);
    return lines.join("\n");
  }
  function formatAsVtt(segments) {
    const lines = ["WEBVTT", ""];
    segments.forEach((segment, index) => {
      const formatVttTime = (ms2) => {
        const totalSeconds = Math.floor(ms2 / 1e3);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor(totalSeconds % 3600 / 60);
        const seconds = totalSeconds % 60;
        const millis = ms2 % 1e3;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
      };
      lines.push(String(index + 1));
      lines.push(`${formatVttTime(segment.startMs)} --> ${formatVttTime(segment.endMs)}`);
      lines.push(segment.text);
      lines.push("");
    });
    return lines.join("\n");
  }
  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  function TranscriptMessage({
    transcript,
    videoTitle,
    onSaveAsNote
  }) {
    const handleDownloadTxt = reactExports.useCallback(() => {
      const content = formatAsPlainText(transcript, videoTitle);
      const safeTitle = videoTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      downloadFile(`transcript_${safeTitle}.txt`, content, "text/plain");
    }, [transcript, videoTitle]);
    const handleDownloadVtt = reactExports.useCallback(() => {
      const content = formatAsVtt(transcript.segments);
      const safeTitle = videoTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      downloadFile(`transcript_${safeTitle}.vtt`, content, "text/vtt");
    }, [transcript.segments, videoTitle]);
    const handleSaveNote = reactExports.useCallback(() => {
      const noteContent = `# Transcript: ${videoTitle}

${transcript.plainText}`;
      onSaveAsNote(noteContent);
    }, [transcript.plainText, videoTitle, onSaveAsNote]);
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-transcript-message", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-transcript-header", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-transcript-title-row", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-transcript-icon", children: "\ud83d\udcdd" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "lockin-transcript-title", children: [
            "Transcript: ",
            videoTitle
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-transcript-meta", children: [
          transcript.segments.length,
          " segments \u2022 ",
          formatTime(transcript.durationMs || 0)
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-transcript-content", children: transcript.plainText }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-transcript-actions", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "lockin-transcript-action-btn",
            onClick: handleDownloadTxt,
            title: "Download as plain text",
            type: "button",
            children: "\ud83d\udce5 Download .txt"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "lockin-transcript-action-btn",
            onClick: handleDownloadVtt,
            title: "Download as VTT with timestamps",
            type: "button",
            children: "\ud83d\udce5 Download .vtt"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "lockin-transcript-action-btn lockin-transcript-action-primary",
            onClick: handleSaveNote,
            title: "Save transcript as note",
            type: "button",
            children: "\ud83d\udcbe Save note"
          }
        )
      ] })
    ] });
  }
  const MAX_IFRAME_DEPTH = 3;
  const PANOPTO_URL_PATTERNS = [
    /https?:\/\/([^/]+\.panopto\.com)\/Panopto\/Pages\/Embed\.aspx\?.*\bid=([a-f0-9-]+)/i,
    /https?:\/\/([^/]+\.panopto\.com)\/Panopto\/Pages\/Viewer\.aspx\?.*\bid=([a-f0-9-]+)/i
  ];
  const ECHO360_DOMAIN_PATTERNS = [
    /echo360\.org(?:\.au|\.uk)?$/i,
    /echo360\.net(?:\.au)?$/i,
    /echo360\.com$/i,
    /echo360\.ca$/i,
    /echo360\.de$/i,
    /echo360\.eu$/i
  ];
  const SECTION_ID_REGEX = /\/section\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const LESSON_ID_REGEX = /\/lessons?\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const MEDIA_ID_REGEX = /\/medias?\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  function extractPanoptoInfo(url) {
    for (const pattern of PANOPTO_URL_PATTERNS) {
      const match = url.match(pattern);
      if (match) {
        return { deliveryId: match[2], tenant: match[1] };
      }
    }
    return null;
  }
  function isEcho360Domain(hostname) {
    const lowerHostname = hostname.toLowerCase();
    console.log("[Lock-in Echo360] isEcho360Domain checking:", lowerHostname);
    if (lowerHostname.includes("echo360")) {
      console.log('[Lock-in Echo360] Found "echo360" in hostname');
      return true;
    }
    for (const pattern of ECHO360_DOMAIN_PATTERNS) {
      if (pattern.test(lowerHostname)) {
        console.log("[Lock-in Echo360] Matched pattern:", pattern);
        return true;
      }
    }
    console.log("[Lock-in Echo360] Not an Echo360 domain");
    return false;
  }
  function extractEchoOrigin(url) {
    console.log("[Lock-in Echo360] extractEchoOrigin called with:", url);
    try {
      const urlObj = new URL(url);
      console.log("[Lock-in Echo360] Parsed hostname:", urlObj.hostname);
      if (isEcho360Domain(urlObj.hostname)) {
        console.log("[Lock-in Echo360] Is Echo360 domain, returning origin:", urlObj.origin);
        return urlObj.origin;
      }
      console.log("[Lock-in Echo360] Not an Echo360 domain");
    } catch (e2) {
      console.log("[Lock-in Echo360] Failed to parse URL:", e2);
    }
    return null;
  }
  function extractSectionId(url) {
    const match = url.match(SECTION_ID_REGEX);
    return match ? match[1] : null;
  }
  function extractLessonId(url) {
    const match = url.match(LESSON_ID_REGEX);
    return match ? match[1] : null;
  }
  function extractMediaId(url) {
    const match = url.match(MEDIA_ID_REGEX);
    return match ? match[1] : null;
  }
  function detectEchoContext(pageUrl, iframeSrcs) {
    console.log("[Lock-in Echo360] detectEchoContext called");
    console.log("[Lock-in Echo360] Page URL:", pageUrl);
    console.log("[Lock-in Echo360] Iframe sources:", iframeSrcs);
    let echoOrigin = null;
    let sectionId = null;
    let lessonId = null;
    let mediaId = null;
    echoOrigin = extractEchoOrigin(pageUrl);
    console.log("[Lock-in Echo360] Extracted echoOrigin from page:", echoOrigin);
    if (echoOrigin) {
      sectionId = extractSectionId(pageUrl);
      lessonId = extractLessonId(pageUrl);
      mediaId = extractMediaId(pageUrl);
      console.log("[Lock-in Echo360] From page URL - sectionId:", sectionId, "lessonId:", lessonId, "mediaId:", mediaId);
    }
    for (const src of iframeSrcs) {
      console.log("[Lock-in Echo360] Checking iframe src:", src);
      const iframeOrigin = extractEchoOrigin(src);
      console.log("[Lock-in Echo360] Iframe echoOrigin:", iframeOrigin);
      if (iframeOrigin) {
        if (!echoOrigin) {
          echoOrigin = iframeOrigin;
        }
        const iframeSectionId = extractSectionId(src);
        const iframeLessonId = extractLessonId(src);
        const iframeMediaId = extractMediaId(src);
        console.log("[Lock-in Echo360] From iframe - sectionId:", iframeSectionId, "lessonId:", iframeLessonId, "mediaId:", iframeMediaId);
        if (!sectionId && iframeSectionId) sectionId = iframeSectionId;
        if (!lessonId && iframeLessonId) lessonId = iframeLessonId;
        if (!mediaId && iframeMediaId) mediaId = iframeMediaId;
      }
    }
    console.log("[Lock-in Echo360] Final echoOrigin:", echoOrigin);
    if (!echoOrigin) {
      console.log("[Lock-in Echo360] No Echo360 context found");
      return null;
    }
    const context = {
      echoOrigin,
      sectionId: sectionId || void 0,
      lessonId: lessonId || void 0,
      mediaId: mediaId || void 0
    };
    console.log("[Lock-in Echo360] Detected context:", context);
    return context;
  }
  function getIframeSrc(iframe) {
    return iframe.src || iframe.getAttribute("data-src") || iframe.dataset.src || "";
  }
  function collectIframes(doc, depth = 0) {
    if (depth > MAX_IFRAME_DEPTH) return [];
    const iframes = Array.from(doc.querySelectorAll("iframe"));
    const result = [...iframes];
    for (const iframe of iframes) {
      try {
        const innerDoc = iframe.contentDocument;
        if (innerDoc) {
          result.push(...collectIframes(innerDoc, depth + 1));
        }
      } catch (e2) {
      }
    }
    return result;
  }
  function addVideo(videos, info, title, embedUrl, videoIndex) {
    if (videos.some((v2) => v2.id === info.deliveryId)) {
      return videoIndex;
    }
    videos.push({
      id: info.deliveryId,
      provider: "panopto",
      title: title || `Panopto video ${videoIndex + 1}`,
      embedUrl
    });
    return videoIndex + 1;
  }
  function detectPanoptoVideos() {
    var _a, _b, _c, _d;
    const videos = [];
    let videoIndex = 0;
    const currentUrl = window.location.href;
    const currentPageInfo = extractPanoptoInfo(currentUrl);
    if (currentPageInfo) {
      const pageTitle = (_a = document.title) == null ? void 0 : _a.trim();
      const title = pageTitle && !pageTitle.toLowerCase().includes("panopto") ? pageTitle : `Panopto video ${videoIndex + 1}`;
      videoIndex = addVideo(videos, currentPageInfo, title, currentUrl, videoIndex);
    }
    const allIframes = collectIframes(document);
    for (const iframe of allIframes) {
      const src = getIframeSrc(iframe);
      if (!src) continue;
      const info = extractPanoptoInfo(src);
      if (info) {
        const title = ((_b = iframe.title) == null ? void 0 : _b.trim()) || "";
        videoIndex = addVideo(videos, info, title, src, videoIndex);
      }
    }
    const mediaElements = document.querySelectorAll(
      'object[data*="panopto"], embed[src*="panopto"]'
    );
    for (const el of mediaElements) {
      const src = el.data || el.src || "";
      const info = extractPanoptoInfo(src);
      if (info) {
        videoIndex = addVideo(videos, info, "", src, videoIndex);
      }
    }
    const panoptoContainers = document.querySelectorAll(
      '[class*="panopto"], [id*="panopto"]'
    );
    for (const container of panoptoContainers) {
      const containerIframes = container.querySelectorAll("iframe");
      for (const iframe of containerIframes) {
        const src = getIframeSrc(iframe);
        const info = extractPanoptoInfo(src);
        if (info) {
          const title = ((_c = iframe.title) == null ? void 0 : _c.trim()) || "";
          videoIndex = addVideo(videos, info, title, src, videoIndex);
        }
      }
    }
    if (videos.length === 0) {
      const links = document.querySelectorAll('a[href*="panopto.com"]');
      for (const link of links) {
        const href = link.href;
        const info = extractPanoptoInfo(href);
        if (info) {
          const linkText = (_d = link.textContent) == null ? void 0 : _d.trim();
          const title = linkText && linkText.length > 3 && linkText.length < 100 ? linkText : "";
          videoIndex = addVideo(videos, info, title, href, videoIndex);
        }
      }
    }
    return videos;
  }
  function extractEcho360OriginFromString(str) {
    const match = str.match(/https?:\/\/[\w.-]*echo360[\w.-]*/i);
    if (match) {
      let origin = match[0];
      origin = origin.replace(/[.-]+$/, "");
      return origin;
    }
    return null;
  }
  function detectEcho360FromDOM() {
    var _a;
    console.log("[Lock-in Echo360] detectEcho360FromDOM - scanning page content");
    let echoOrigin = null;
    let sectionId = null;
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const content = script.textContent || "";
      const srcAttr = script.src || "";
      if (srcAttr.includes("echo360")) {
        console.log("[Lock-in Echo360] Found echo360 in script src:", srcAttr);
        const origin = extractEcho360OriginFromString(srcAttr);
        if (origin && !echoOrigin) echoOrigin = origin;
      }
      if (content.includes("echo360")) {
        console.log("[Lock-in Echo360] Found echo360 in script content");
        const origin = extractEcho360OriginFromString(content);
        if (origin && !echoOrigin) echoOrigin = origin;
        const secMatch = content.match(/\/section\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (secMatch && !sectionId) {
          sectionId = secMatch[1];
          console.log("[Lock-in Echo360] Found sectionId in script:", sectionId);
        }
        const jsonSecMatch = content.match(/["']sectionId["']\s*:\s*["']([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})["']/i);
        if (jsonSecMatch && !sectionId) {
          sectionId = jsonSecMatch[1];
          console.log("[Lock-in Echo360] Found sectionId in JSON:", sectionId);
        }
      }
    }
    const echoElements = document.querySelectorAll('[data-echo], [data-echo360], [class*="echo360"], [class*="echovideo"]');
    console.log("[Lock-in Echo360] Found echo-related elements:", echoElements.length);
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      const allowAttr = iframe.getAttribute("allow") || "";
      const srcAttr = iframe.src || "";
      if (allowAttr.includes("echo360")) {
        console.log("[Lock-in Echo360] Found echo360 in iframe allow attribute:", allowAttr);
        const origin = extractEcho360OriginFromString(allowAttr);
        if (origin && !echoOrigin) {
          echoOrigin = origin;
          console.log("[Lock-in Echo360] Extracted origin from allow attr:", echoOrigin);
        }
      }
      if (srcAttr.includes("section")) {
        const secMatch = srcAttr.match(/section[=\/]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (secMatch && !sectionId) {
          sectionId = secMatch[1];
          console.log("[Lock-in Echo360] Found sectionId in iframe src:", sectionId);
        }
      }
      try {
        const iframeDoc = iframe.contentDocument;
        if (iframeDoc) {
          console.log("[Lock-in Echo360] Accessing iframe content (same-origin)");
          const iframeUrl = (_a = iframeDoc.location) == null ? void 0 : _a.href;
          if (iframeUrl) {
            console.log("[Lock-in Echo360] Iframe URL:", iframeUrl);
            const origin = extractEcho360OriginFromString(iframeUrl);
            if (origin && !echoOrigin) echoOrigin = origin;
            const secMatch = iframeUrl.match(/\/section\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            if (secMatch && !sectionId) sectionId = secMatch[1];
          }
          const iframeScripts = iframeDoc.querySelectorAll("script");
          for (const script of iframeScripts) {
            const content = script.textContent || "";
            if (content.includes("echo360") || content.includes("section")) {
              const origin = extractEcho360OriginFromString(content);
              if (origin && !echoOrigin) echoOrigin = origin;
              const secMatch = content.match(/\/section\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
              if (secMatch && !sectionId) sectionId = secMatch[1];
            }
          }
        }
      } catch (e2) {
        console.log("[Lock-in Echo360] Cannot access iframe content (cross-origin)");
      }
    }
    const links = document.querySelectorAll('a[href*="echo360"]');
    for (const link of links) {
      const href = link.href;
      console.log("[Lock-in Echo360] Found echo360 link:", href);
      const origin = extractEcho360OriginFromString(href);
      if (origin && !echoOrigin) echoOrigin = origin;
      const secMatch = href.match(/\/section\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (secMatch && !sectionId) sectionId = secMatch[1];
    }
    const allDataAttrs = document.querySelectorAll("[data-section-id], [data-sectionid], [data-echo-section]");
    for (const el of allDataAttrs) {
      const secId = el.getAttribute("data-section-id") || el.getAttribute("data-sectionid") || el.getAttribute("data-echo-section");
      if (secId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(secId)) {
        sectionId = secId;
        console.log("[Lock-in Echo360] Found sectionId in data attribute:", sectionId);
      }
    }
    console.log("[Lock-in Echo360] DOM detection result - echoOrigin:", echoOrigin, "sectionId:", sectionId);
    return { echoOrigin, sectionId };
  }
  function detectEcho360Videos() {
    console.log("[Lock-in Echo360] detectEcho360Videos called");
    console.log("[Lock-in Echo360] Current URL:", window.location.href);
    console.log("[Lock-in Echo360] Current hostname:", window.location.hostname);
    const allIframes = collectIframes(document);
    console.log("[Lock-in Echo360] Found iframes:", allIframes.length);
    const iframeSrcs = allIframes.map((iframe) => getIframeSrc(iframe)).filter(Boolean);
    console.log("[Lock-in Echo360] Iframe srcs:", iframeSrcs);
    let context = detectEchoContext(window.location.href, iframeSrcs);
    if (!context) {
      console.log("[Lock-in Echo360] URL-based detection failed, trying DOM detection");
      const domResult = detectEcho360FromDOM();
      if (domResult.echoOrigin) {
        context = {
          echoOrigin: domResult.echoOrigin,
          sectionId: domResult.sectionId || void 0
        };
        console.log("[Lock-in Echo360] DOM detection found context:", context);
      }
    }
    if (!context) {
      console.log("[Lock-in Echo360] No context detected, returning empty");
      return { context: null, videos: [] };
    }
    const videos = [];
    if (context.lessonId && context.mediaId) {
      console.log("[Lock-in Echo360] Found specific lesson/media, creating single entry");
      videos.push({
        id: `${context.lessonId}|${context.mediaId}`,
        provider: "echo360",
        title: "Current Echo360 video",
        embedUrl: `${context.echoOrigin}/lesson/${context.lessonId}/media/${context.mediaId}`
      });
    } else if (context.sectionId) {
      console.log("[Lock-in Echo360] Found section, creating placeholder entry");
      videos.push({
        id: `section:${context.sectionId}`,
        provider: "echo360",
        title: "Echo360 course (click to load videos)",
        embedUrl: `${context.echoOrigin}/section/${context.sectionId}`
      });
    } else {
      console.log("[Lock-in Echo360] Have echoOrigin but no sectionId - LTI embed detected");
      videos.push({
        id: `lti:${context.echoOrigin}`,
        provider: "echo360",
        title: '\u26a0\ufe0f Echo360 detected - Right-click the video area and "Open frame in new tab" to extract transcripts',
        embedUrl: context.echoOrigin
      });
    }
    console.log("[Lock-in Echo360] Returning videos:", videos);
    return { context, videos };
  }
  function detectAllVideos() {
    console.log("[Lock-in] detectAllVideos called");
    const panoptoVideos = detectPanoptoVideos();
    console.log("[Lock-in] Panopto videos found:", panoptoVideos.length);
    const { context: echoContext, videos: echoVideos } = detectEcho360Videos();
    console.log("[Lock-in] Echo360 videos found:", echoVideos.length, "context:", echoContext);
    const allVideos = [...panoptoVideos, ...echoVideos];
    console.log("[Lock-in] Total videos:", allVideos.length);
    return {
      videos: allVideos,
      echoContext
    };
  }
  function sendToBackground(message) {
    return __async(this, null, function* () {
      return new Promise((resolve, reject) => {
        if (typeof chrome === "undefined" || !chrome.runtime) {
          reject(new Error("Chrome runtime not available"));
          return;
        }
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    });
  }
  function normalizeTranscriptResponse(response) {
    var _a, _b;
    return (_b = response.data) != null ? _b : {
      success: (_a = response.success) != null ? _a : false,
      transcript: response.transcript,
      error: response.error,
      aiTranscriptionAvailable: response.aiTranscriptionAvailable
    };
  }
  const INITIAL_STATE = {
    isVideoListOpen: false,
    videos: [],
    isDetecting: false,
    isExtracting: false,
    extractingVideoId: null,
    error: null,
    lastTranscript: null,
    echoContext: null,
    isFetchingEchoVideos: false
  };
  function useTranscripts() {
    const [state, setState] = reactExports.useState(INITIAL_STATE);
    const openVideoList = reactExports.useCallback(() => {
      setState((prev) => __spreadProps(__spreadValues({}, prev), { isVideoListOpen: true, error: null }));
    }, []);
    const closeVideoList = reactExports.useCallback(() => {
      setState((prev) => __spreadProps(__spreadValues({}, prev), { isVideoListOpen: false }));
    }, []);
    const fetchEchoVideoList = reactExports.useCallback((context) => __async(null, null, function* () {
      console.log("[Lock-in Echo360] fetchEchoVideoList called with context:", context);
      setState((prev) => __spreadProps(__spreadValues({}, prev), { isFetchingEchoVideos: true }));
      try {
        console.log("[Lock-in Echo360] Sending FETCH_ECHO360_VIDEOS to background...");
        const response = yield sendToBackground({
          type: "FETCH_ECHO360_VIDEOS",
          payload: { context }
        });
        console.log("[Lock-in Echo360] Background response:", response);
        if (response.success && response.videos) {
          console.log("[Lock-in Echo360] Got videos:", response.videos.length);
          setState((prev) => {
            const nonEchoVideos = prev.videos.filter((v2) => v2.provider !== "echo360");
            const echoVideos = response.videos.filter(
              (v2) => !v2.id.startsWith("section:")
            );
            console.log("[Lock-in Echo360] Merging videos - non-echo:", nonEchoVideos.length, "echo:", echoVideos.length);
            return __spreadProps(__spreadValues({}, prev), {
              videos: [...nonEchoVideos, ...echoVideos],
              isFetchingEchoVideos: false
            });
          });
        } else {
          console.log("[Lock-in Echo360] Error response:", response.error);
          setState((prev) => __spreadProps(__spreadValues({}, prev), {
            isFetchingEchoVideos: false,
            error: response.error || "Failed to fetch Echo360 videos"
          }));
        }
      } catch (error) {
        console.error("[Lock-in Echo360] fetchEchoVideoList error:", error);
        setState((prev) => __spreadProps(__spreadValues({}, prev), {
          isFetchingEchoVideos: false,
          error: error instanceof Error ? error.message : "Failed to fetch Echo360 videos"
        }));
      }
    }), []);
    const detectVideos = reactExports.useCallback(() => {
      console.log("[Lock-in] detectVideos callback starting...");
      setState((prev) => __spreadProps(__spreadValues({}, prev), { isDetecting: true, error: null }));
      try {
        const { videos, echoContext } = detectAllVideos();
        console.log("[Lock-in] detectAllVideos result - videos:", videos.length, "echoContext:", echoContext);
        setState((prev) => __spreadProps(__spreadValues({}, prev), { videos, echoContext, isDetecting: false }));
        if (echoContext == null ? void 0 : echoContext.sectionId) {
          console.log("[Lock-in] Echo360 sectionId found, calling fetchEchoVideoList...");
          fetchEchoVideoList(echoContext);
        } else {
          console.log("[Lock-in] No Echo360 sectionId, skipping video list fetch");
        }
      } catch (error) {
        console.error("[Lock-in] detectVideos error:", error);
        setState((prev) => __spreadProps(__spreadValues({}, prev), {
          isDetecting: false,
          error: error instanceof Error ? error.message : "Failed to detect videos"
        }));
      }
    }, [fetchEchoVideoList]);
    const extractTranscript = reactExports.useCallback(
      (video) => __async(null, null, function* () {
        if (video.id.startsWith("lti:")) {
          setState((prev) => __spreadProps(__spreadValues({}, prev), {
            error: 'To extract Echo360 transcripts: Right-click on the video area below and select "Open frame in new tab", then try again from the new tab.'
          }));
          return null;
        }
        if (video.id.startsWith("section:")) {
          setState((prev) => __spreadProps(__spreadValues({}, prev), {
            error: "Please wait for the video list to load, then select a specific video."
          }));
          return null;
        }
        setState((prev) => __spreadProps(__spreadValues({}, prev), {
          isExtracting: true,
          extractingVideoId: video.id,
          error: null
        }));
        try {
          let videoPayload = video;
          if (video.provider === "echo360") {
            const [lessonId, mediaId] = video.id.split("|");
            const echoVideo = video;
            videoPayload = __spreadProps(__spreadValues({}, video), {
              echoOrigin: echoVideo.echoOrigin || extractEchoOrigin(video.embedUrl) || "",
              lessonId: echoVideo.lessonId || lessonId,
              mediaId: echoVideo.mediaId || mediaId,
              sectionId: echoVideo.sectionId
            });
          }
          const response = yield sendToBackground({
            type: "EXTRACT_TRANSCRIPT",
            payload: { video: videoPayload }
          });
          const result = normalizeTranscriptResponse(response);
          if (result.success && result.transcript) {
            setState((prev) => __spreadProps(__spreadValues({}, prev), {
              isExtracting: false,
              extractingVideoId: null,
              isVideoListOpen: false,
              lastTranscript: { video, transcript: result.transcript }
            }));
            return result.transcript;
          }
          const errorMessage = result.error || "Failed to extract transcript";
          setState((prev) => __spreadProps(__spreadValues({}, prev), {
            isExtracting: false,
            extractingVideoId: null,
            error: result.aiTranscriptionAvailable ? `${errorMessage} (AI transcription available as fallback)` : errorMessage
          }));
          return null;
        } catch (error) {
          setState((prev) => __spreadProps(__spreadValues({}, prev), {
            isExtracting: false,
            extractingVideoId: null,
            error: error instanceof Error ? error.message : "Unknown error"
          }));
          return null;
        }
      }),
      []
    );
    const clearError = reactExports.useCallback(() => {
      setState((prev) => __spreadProps(__spreadValues({}, prev), { error: null }));
    }, []);
    return {
      state,
      openVideoList,
      closeVideoList,
      detectVideos,
      extractTranscript,
      clearError
    };
  }
  const MODE_OPTIONS = [
    { value: "explain", label: "Explain", hint: "Clarify the selection" },
    {
      value: "general",
      label: "General",
      hint: "Ask anything about the content"
    }
  ];
  const CHAT_TAB_ID = "chat";
  const NOTES_TAB_ID = "notes";
  const SIDEBAR_ACTIVE_TAB_KEY = "lockin_sidebar_activeTab";
  const MODE_STORAGE_KEY = "lockinActiveMode";
  const SELECTED_NOTE_ID_KEY = "lockin_sidebar_selectedNoteId";
  const ACTIVE_CHAT_ID_KEY = "lockin_sidebar_activeChatId";
  function isValidUUID(value) {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }
  function relativeLabel(iso) {
    if (!iso) return "just now";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "just now";
    const delta = Date.now() - date.getTime();
    const minutes = Math.round(delta / 6e4);
    if (minutes <= 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }
  function textSnippet(text, length = 80) {
    if (!text) return "Untitled chat";
    if (text.length <= length) return text;
    return `${text.slice(0, length)}...`;
  }
  function SaveNoteAction({ onSaveAsNote }) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-chat-save-note-action", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        className: "lockin-chat-save-note-btn",
        onClick: (e2) => {
          e2.stopPropagation();
          onSaveAsNote();
        },
        type: "button",
        children: "Save note"
      }
    ) });
  }
  function ModeSelector({
    value,
    onSelect,
    onTranscriptAction
  }) {
    const [isOpen, setIsOpen] = reactExports.useState(false);
    const toggle = () => setIsOpen((prev) => !prev);
    reactExports.useEffect(() => {
      const handler = () => setIsOpen(false);
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    }, []);
    const current = MODE_OPTIONS.find((option) => option.value === value);
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "lockin-mode-selector-container",
        onClick: (e2) => e2.stopPropagation(),
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "button",
            {
              className: "lockin-mode-pill",
              onClick: toggle,
              "aria-haspopup": "listbox",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-mode-icon", children: "*" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: (current == null ? void 0 : current.label) || "Mode" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-mode-chevron", children: "v" })
              ]
            }
          ),
          isOpen && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-mode-expandable", role: "listbox", children: [
            MODE_OPTIONS.map((option) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                className: "lockin-mode-option",
                onClick: () => {
                  onSelect(option.value);
                  setIsOpen(false);
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-mode-option-icon", children: "-" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: option.label }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "11px", color: "#6b7280" }, children: option.hint })
                  ] })
                ]
              },
              option.value
            )),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-mode-divider" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                className: "lockin-mode-option lockin-mode-option-action",
                onClick: () => {
                  onTranscriptAction();
                  setIsOpen(false);
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-mode-option-icon", children: "\ud83d\udcf9" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: "Extract video transcript" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "11px", color: "#6b7280" }, children: "Get captions from Panopto videos" })
                  ] })
                ]
              }
            )
          ] })
        ]
      }
    );
  }
  function LockInSidebar({
    apiClient,
    isOpen,
    onToggle,
    currentMode,
    selectedText,
    pageContext,
    storage,
    activeTabExternal
  }) {
    var _a;
    const [activeTab, setActiveTab] = reactExports.useState(
      activeTabExternal || CHAT_TAB_ID
    );
    const [mode, setMode] = reactExports.useState(currentMode);
    const [messages, setMessages] = reactExports.useState([]);
    const [recentChats, setRecentChats] = reactExports.useState([]);
    const [activeHistoryId, setActiveHistoryId] = reactExports.useState(null);
    const [isHistoryOpen, setIsHistoryOpen] = reactExports.useState(false);
    const [chatId, setChatId] = reactExports.useState(null);
    const [inputValue, setInputValue] = reactExports.useState("");
    const [chatError, setChatError] = reactExports.useState(null);
    const [isSending, setIsSending] = reactExports.useState(false);
    const [selectedNoteId, setSelectedNoteId] = reactExports.useState(null);
    const [isNoteEditing, setIsNoteEditing] = reactExports.useState(false);
    const [isNoteIdLoaded, setIsNoteIdLoaded] = reactExports.useState(false);
    const lastForceOpenRef = reactExports.useRef(0);
    const previousSelectionRef = reactExports.useRef();
    const layoutTimeoutRef = reactExports.useRef(null);
    const notesService = reactExports.useMemo(
      () => apiClient ? createNotesService(apiClient) : null,
      [apiClient]
    );
    const courseCode = (pageContext == null ? void 0 : pageContext.courseContext.courseCode) || null;
    const pageUrl = (pageContext == null ? void 0 : pageContext.url) || (typeof window !== "undefined" ? window.location.href : "");
    const {
      notes,
      isLoading: notesLoading,
      refresh: refreshNotes,
      upsertNote,
      deleteNote: deleteNoteFromList,
      toggleStar: toggleNoteStar
    } = useNotesList({
      notesService,
      limit: 50
    });
    const {
      state: transcriptState,
      openVideoList,
      closeVideoList,
      detectVideos,
      extractTranscript
      // clearError: clearTranscriptError, // Available for future use (e.g., dismiss error toast)
    } = useTranscripts();
    const applySplitLayout = reactExports.useCallback((open) => {
      const body = document.body;
      const html = document.documentElement;
      if (!body || !html) return;
      if (open) {
        body.classList.add("lockin-sidebar-open");
        html.classList.add("lockin-sidebar-transitioning");
      } else {
        body.classList.remove("lockin-sidebar-open");
      }
      if (layoutTimeoutRef.current) {
        window.clearTimeout(layoutTimeoutRef.current);
      }
      layoutTimeoutRef.current = window.setTimeout(() => {
        html.classList.remove("lockin-sidebar-transitioning");
      }, 320);
    }, []);
    const handleTabChange = reactExports.useCallback((tabId) => {
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      setActiveTab(tabId);
      requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY);
      });
    }, []);
    reactExports.useEffect(() => {
      if (!storage) return;
      storage.get(SIDEBAR_ACTIVE_TAB_KEY).then((tab) => {
        if (tab === CHAT_TAB_ID || tab === NOTES_TAB_ID) {
          setActiveTab(tab);
        }
      });
    }, [storage]);
    reactExports.useEffect(() => {
      if (!storage) {
        setIsNoteIdLoaded(true);
        return;
      }
      storage.get(SELECTED_NOTE_ID_KEY).then((noteId) => {
        if (noteId && isValidUUID(noteId)) {
          setSelectedNoteId(noteId);
        }
        setIsNoteIdLoaded(true);
      }).catch(() => {
        setIsNoteIdLoaded(true);
      });
    }, [storage]);
    reactExports.useEffect(() => {
      if (!storage || !isNoteIdLoaded) return;
      if (selectedNoteId) {
        storage.set(SELECTED_NOTE_ID_KEY, selectedNoteId).catch(() => {
        });
      } else {
        storage.set(SELECTED_NOTE_ID_KEY, null).catch(() => {
        });
      }
    }, [selectedNoteId, storage, isNoteIdLoaded]);
    reactExports.useEffect(() => {
      if (!storage) return;
      storage.get(ACTIVE_CHAT_ID_KEY).then((storedChatId) => __async(null, null, function* () {
        if (storedChatId && isValidUUID(storedChatId)) {
          setChatId(storedChatId);
          setActiveHistoryId(storedChatId);
          if (apiClient == null ? void 0 : apiClient.getChatMessages) {
            try {
              const response = yield apiClient.getChatMessages(storedChatId);
              if (Array.isArray(response)) {
                const normalized = response.map(
                  (message) => ({
                    id: message.id || `msg-${Math.random().toString(16).slice(2)}`,
                    role: message.role === "assistant" ? "assistant" : "user",
                    content: message.content || message.output_text || message.input_text || "Message",
                    timestamp: message.created_at || (/* @__PURE__ */ new Date()).toISOString(),
                    mode: message.mode || mode
                  })
                );
                setMessages(normalized);
              }
            } catch (e2) {
            }
          }
        }
      })).catch(() => {
      });
    }, [storage, apiClient, mode]);
    reactExports.useEffect(() => {
      if (!storage) return;
      if (chatId && isValidUUID(chatId)) {
        storage.set(ACTIVE_CHAT_ID_KEY, chatId).catch(() => {
        });
      }
    }, [chatId, storage]);
    reactExports.useEffect(() => {
      if (!storage) return;
      storage.set(SIDEBAR_ACTIVE_TAB_KEY, activeTab).catch(() => {
      });
    }, [activeTab, storage]);
    reactExports.useEffect(() => {
      if (!storage) return;
      storage.set(MODE_STORAGE_KEY, mode).catch(() => {
      });
    }, [mode, storage]);
    reactExports.useEffect(() => {
      if (!activeTabExternal) return;
      setActiveTab(
        (current) => current === activeTabExternal ? current : activeTabExternal
      );
    }, [activeTabExternal]);
    reactExports.useEffect(() => {
      applySplitLayout(isOpen);
      return () => {
        applySplitLayout(false);
        if (layoutTimeoutRef.current) {
          window.clearTimeout(layoutTimeoutRef.current);
        }
      };
    }, [applySplitLayout, isOpen]);
    reactExports.useEffect(() => {
      const handleKeyDown = (event) => {
        if (event.key === "Escape" && isOpen) {
          onToggle();
        }
      };
      if (isOpen) {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
      }
      return void 0;
    }, [isOpen, onToggle]);
    reactExports.useEffect(() => {
      setMode(currentMode);
    }, [currentMode]);
    reactExports.useEffect(() => {
      if (isNoteEditing && !isOpen) {
        const now = Date.now();
        if (now - lastForceOpenRef.current > 400) {
          lastForceOpenRef.current = now;
          onToggle();
        }
      }
    }, [isNoteEditing, isOpen, onToggle]);
    const upsertHistory = reactExports.useCallback(
      (item, previousId) => {
        setRecentChats((prev) => {
          const filtered = prev.filter(
            (history) => history.id !== item.id && (!previousId || history.id !== previousId)
          );
          return [item, ...filtered].slice(0, 12);
        });
      },
      []
    );
    const triggerProcess = reactExports.useCallback(
      (_0) => __async(null, [_0], function* ({
        selection,
        newUserMessage,
        chatHistory,
        provisionalChatId
      }) {
        var _a2;
        const trimmedSelection = selection || selectedText || "";
        if (!trimmedSelection && !newUserMessage) return;
        setChatError(null);
        setIsSending(true);
        const pendingId = `assistant-${Date.now()}`;
        const pendingMessage = {
          id: pendingId,
          role: "assistant",
          content: "Thinking...",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          mode,
          isPending: true
        };
        setMessages((prev) => [...prev, pendingMessage]);
        try {
          const baseHistory = (chatHistory || messages).map((message) => ({
            role: message.role,
            content: message.content
          }));
          const apiChatId = isValidUUID(chatId) && chatId ? chatId : void 0;
          const response = (apiClient == null ? void 0 : apiClient.processText) ? yield apiClient.processText({
            selection: trimmedSelection,
            mode,
            chatHistory: baseHistory,
            newUserMessage,
            chatId: apiChatId,
            pageUrl,
            courseCode: courseCode || void 0
          }) : null;
          const explanation = ((_a2 = response == null ? void 0 : response.data) == null ? void 0 : _a2.explanation) || `(${mode}) ${newUserMessage || trimmedSelection}`;
          const resolvedChatId = (response == null ? void 0 : response.chatId) || chatId || provisionalChatId || null;
          const now = (/* @__PURE__ */ new Date()).toISOString();
          setMessages(
            (prev) => prev.map(
              (message) => message.id === pendingId ? __spreadProps(__spreadValues({}, message), { content: explanation, isPending: false }) : message
            )
          );
          if (resolvedChatId) {
            setChatId(resolvedChatId);
            setActiveHistoryId(resolvedChatId);
            upsertHistory(
              {
                id: resolvedChatId,
                title: textSnippet(newUserMessage || trimmedSelection, 48),
                updatedAt: now,
                lastMessage: explanation
              },
              provisionalChatId
            );
          }
        } catch (error) {
          const fallback = (error == null ? void 0 : error.message) || "We could not process this request. Try again in a moment.";
          setChatError(fallback);
          setMessages(
            (prev) => prev.map(
              (message) => message.id === pendingId ? __spreadProps(__spreadValues({}, message), { content: fallback, isPending: false }) : message
            )
          );
        } finally {
          setIsSending(false);
        }
      }),
      [
        apiClient,
        chatId,
        courseCode,
        messages,
        mode,
        pageUrl,
        selectedText,
        upsertHistory
      ]
    );
    const startNewChat = reactExports.useCallback(
      (text, source = "selection") => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const provisionalChatId = `chat-${Date.now()}`;
        const userMessage = {
          id: `${provisionalChatId}-user`,
          role: "user",
          content: trimmed,
          timestamp: now,
          mode,
          source
        };
        setActiveTab(CHAT_TAB_ID);
        setIsHistoryOpen(false);
        setChatError(null);
        setMessages([userMessage]);
        setChatId(null);
        setActiveHistoryId(provisionalChatId);
        upsertHistory({
          id: provisionalChatId,
          title: textSnippet(trimmed, 48),
          updatedAt: now,
          lastMessage: trimmed
        });
        triggerProcess({
          selection: trimmed,
          chatHistory: [userMessage],
          provisionalChatId
        });
      },
      [mode, triggerProcess, upsertHistory]
    );
    const appendSelectionToCurrentChat = reactExports.useCallback(
      (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const userMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: trimmed,
          timestamp: now,
          mode,
          source: "selection"
        };
        const provisionalChatId = isValidUUID(chatId) ? chatId : activeHistoryId || `chat-${Date.now()}`;
        setActiveTab(CHAT_TAB_ID);
        setIsHistoryOpen(false);
        setChatError(null);
        setActiveHistoryId(provisionalChatId);
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        upsertHistory({
          id: provisionalChatId,
          title: textSnippet(trimmed, 48),
          updatedAt: now,
          lastMessage: trimmed
        });
        triggerProcess({
          selection: trimmed,
          newUserMessage: trimmed,
          chatHistory: nextMessages,
          provisionalChatId
        });
      },
      [activeHistoryId, chatId, messages, mode, triggerProcess, upsertHistory]
    );
    reactExports.useEffect(() => {
      if (!selectedText || selectedText.trim().length === 0) return;
      if (previousSelectionRef.current === selectedText) return;
      previousSelectionRef.current = selectedText;
      if (messages.length === 0) {
        startNewChat(selectedText, "selection");
      } else {
        appendSelectionToCurrentChat(selectedText);
      }
    }, [
      appendSelectionToCurrentChat,
      messages.length,
      selectedText,
      startNewChat
    ]);
    reactExports.useEffect(() => {
      const loadHistory = () => __async(null, null, function* () {
        if (!(apiClient == null ? void 0 : apiClient.getRecentChats)) return;
        try {
          const result = yield apiClient.getRecentChats({ limit: 8 });
          if (Array.isArray(result)) {
            const mapped = result.map((item) => ({
              id: item.id || `chat-${Math.random().toString(16).slice(2)}`,
              title: item.title || "Conversation",
              updatedAt: item.updated_at || item.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
              lastMessage: item.lastMessage || ""
            }));
            setRecentChats(mapped);
          }
        } catch (e2) {
        }
      });
      loadHistory();
    }, [apiClient]);
    reactExports.useEffect(() => {
      if (activeTab === NOTES_TAB_ID) {
        refreshNotes();
      }
    }, [activeTab, refreshNotes]);
    const handleHistorySelect = reactExports.useCallback(
      (item) => __async(null, null, function* () {
        if (!(apiClient == null ? void 0 : apiClient.getChatMessages)) return;
        setIsSending(true);
        setChatError(null);
        setActiveHistoryId(item.id);
        setChatId(item.id);
        try {
          const response = yield apiClient.getChatMessages(item.id);
          if (Array.isArray(response)) {
            const normalized = response.map(
              (message) => ({
                id: message.id || `msg-${Math.random().toString(16).slice(2)}`,
                role: message.role === "assistant" ? "assistant" : "user",
                content: message.content || message.output_text || message.input_text || "Message",
                timestamp: message.created_at || (/* @__PURE__ */ new Date()).toISOString(),
                mode: message.mode || mode
              })
            );
            setMessages(normalized);
          }
        } catch (error) {
          setChatError(
            (error == null ? void 0 : error.message) || "Could not load this conversation. Try refreshing the page."
          );
        } finally {
          setIsSending(false);
        }
      }),
      [apiClient, mode]
    );
    const handleSend = reactExports.useCallback(() => {
      if (!inputValue.trim() || isSending) return;
      appendSelectionToCurrentChat(inputValue);
      setInputValue("");
    }, [appendSelectionToCurrentChat, inputValue, isSending]);
    const startBlankChat = () => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const provisionalChatId = `chat-${Date.now()}`;
      setActiveTab(CHAT_TAB_ID);
      setIsHistoryOpen(false);
      setChatError(null);
      setMessages([]);
      setInputValue("");
      setChatId(null);
      setActiveHistoryId(provisionalChatId);
      upsertHistory({
        id: provisionalChatId,
        title: "New chat",
        updatedAt: now,
        lastMessage: ""
      });
    };
    const handleSaveAsNote = reactExports.useCallback(
      (messageContent) => __async(null, null, function* () {
        if (!notesService) {
          setActiveTab(NOTES_TAB_ID);
          return;
        }
        try {
          const title = messageContent.split("\n")[0].trim().slice(0, 50) || "Untitled note";
          const createdNote = yield notesService.createNote({
            title,
            content: createNoteContentFromPlainText(messageContent.trim()),
            sourceUrl: pageUrl,
            courseCode: courseCode || null,
            noteType: "manual"
          });
          upsertNote(createdNote);
          setSelectedNoteId(createdNote.id);
          setActiveTab(NOTES_TAB_ID);
        } catch (error) {
          console.error("Failed to save note:", error);
          setActiveTab(NOTES_TAB_ID);
        }
      }),
      [courseCode, notesService, pageUrl, upsertNote]
    );
    const handleExtractTranscriptAction = reactExports.useCallback(() => {
      setActiveTab(CHAT_TAB_ID);
      openVideoList();
      detectVideos();
    }, [openVideoList, detectVideos]);
    const handleVideoSelect = reactExports.useCallback(
      (video) => __async(null, null, function* () {
        const transcript = yield extractTranscript(video);
        if (transcript) {
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const transcriptMessage = {
            id: `transcript-${Date.now()}`,
            role: "assistant",
            content: transcript.plainText,
            timestamp: now,
            source: "transcript",
            transcript: { video, result: transcript }
          };
          setMessages((prev) => [...prev, transcriptMessage]);
        }
      }),
      [extractTranscript]
    );
    const renderChatMessages = () => {
      if (!messages.length) {
        return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-chat-empty", children: "Ask anything about this page to start a new chat." });
      }
      return messages.map((message) => {
        if (message.transcript) {
          return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-chat-msg lockin-chat-msg-assistant", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            TranscriptMessage,
            {
              transcript: message.transcript.result,
              videoTitle: message.transcript.video.title,
              onSaveAsNote: handleSaveAsNote
            }
          ) }, message.id);
        }
        const roleClass = message.role === "assistant" ? "lockin-chat-msg lockin-chat-msg-assistant" : "lockin-chat-msg lockin-chat-msg-user";
        const bubbleClass = message.role === "assistant" ? "lockin-chat-bubble" : "lockin-chat-bubble";
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: roleClass, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: `${bubbleClass}${message.isPending ? " lockin-chat-msg-pending" : ""}`,
              children: message.content
            }
          ),
          message.role === "assistant" && !message.isPending ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            SaveNoteAction,
            {
              onSaveAsNote: () => handleSaveAsNote(message.content)
            }
          ) : null
        ] }, message.id);
      });
    };
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      !isOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          id: "lockin-toggle-pill",
          onClick: onToggle,
          "aria-label": "Open Lock-in sidebar",
          children: "Lock-in"
        }
      ),
      isOpen && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          id: "lockin-sidebar",
          className: "lockin-sidebar",
          "data-state": isOpen ? "expanded" : "collapsed",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-top-bar", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-top-bar-left", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-brand", children: "Lock-in" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-tabs-wrapper", role: "tablist", children: [CHAT_TAB_ID, NOTES_TAB_ID].map((tabId) => {
                  const label = tabId === CHAT_TAB_ID ? "Chat" : "Notes";
                  const isActive = activeTab === tabId;
                  return /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: `lockin-tab ${isActive ? "lockin-tab-active" : ""}`,
                      onClick: () => handleTabChange(tabId),
                      role: "tab",
                      "aria-selected": isActive,
                      children: label
                    },
                    tabId
                  );
                }) })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  className: "lockin-close-btn",
                  onClick: onToggle,
                  "aria-label": "Close sidebar",
                  children: "x"
                }
              )
            ] }),
            activeTab === CHAT_TAB_ID && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-chat-toolbar", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-chat-toolbar-left", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "button",
                  {
                    className: "lockin-history-toggle-btn",
                    onClick: () => setIsHistoryOpen((prev) => !prev),
                    "aria-label": "Toggle chat history",
                    "aria-pressed": isHistoryOpen,
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "span",
                        {
                          className: "lockin-history-toggle-icon",
                          "aria-hidden": "true",
                          children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-history-toggle-line" }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-history-toggle-line" }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-history-toggle-line" })
                          ]
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-sr-only", children: "Toggle chat history" })
                    ]
                  }
                ) }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-chat-toolbar-right", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    ModeSelector,
                    {
                      value: mode,
                      onSelect: (newMode) => setMode(newMode),
                      onTranscriptAction: handleExtractTranscriptAction
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: "lockin-new-chat-btn",
                      onClick: startBlankChat,
                      children: "+ New chat"
                    }
                  )
                ] })
              ] }),
              transcriptState.isVideoListOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(
                VideoListPanel,
                {
                  videos: transcriptState.videos,
                  isLoading: transcriptState.isDetecting,
                  isExtracting: transcriptState.isExtracting,
                  extractingVideoId: transcriptState.extractingVideoId,
                  onSelectVideo: handleVideoSelect,
                  onClose: closeVideoList,
                  error: transcriptState.error || void 0
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "lockin-chat-container",
                  "data-history-state": isHistoryOpen ? "open" : "closed",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "aside",
                      {
                        className: "lockin-chat-history-panel",
                        "data-state": isHistoryOpen ? "open" : "closed",
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-history-actions", children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "lockin-history-label", children: "Chats" }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                              "button",
                              {
                                className: "lockin-new-chat-btn",
                                onClick: startBlankChat,
                                children: "+ New chat"
                              }
                            )
                          ] }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-history-list", children: recentChats.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-history-empty", children: "No chats yet. Start from a highlight or a question." }) : recentChats.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                            "button",
                            {
                              className: `lockin-history-item ${activeHistoryId === item.id ? "active" : ""}`,
                              onClick: () => handleHistorySelect(item),
                              children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-history-item-content", children: [
                                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-history-title", children: item.title }),
                                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-history-meta", children: relativeLabel(item.updatedAt) })
                              ] })
                            },
                            item.id
                          )) })
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-chat-main", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-chat-content", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-chat-messages-wrapper", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-chat-messages", children: [
                        renderChatMessages(),
                        chatError && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-chat-error", children: chatError })
                      ] }) }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lockin-chat-bottom-section", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lockin-chat-input", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "textarea",
                          {
                            className: "lockin-chat-input-field",
                            placeholder: "Ask a follow-up question...",
                            value: inputValue,
                            onChange: (e2) => setInputValue(e2.target.value),
                            onKeyDown: (e2) => {
                              if (e2.key === "Enter" && !e2.shiftKey) {
                                e2.preventDefault();
                                if (inputValue.trim() && !isSending) {
                                  handleSend();
                                }
                              }
                            },
                            rows: 1
                          }
                        ),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            className: "lockin-send-btn",
                            disabled: !inputValue.trim() || isSending,
                            onClick: handleSend,
                            children: "Send"
                          }
                        )
                      ] }) })
                    ] }) })
                  ]
                }
              )
            ] }),
            activeTab === NOTES_TAB_ID && /* @__PURE__ */ jsxRuntimeExports.jsx(
              NotesPanel,
              {
                notesService,
                notes,
                notesLoading,
                onRefreshNotes: refreshNotes,
                onNoteSaved: (note) => {
                  upsertNote(note);
                  setSelectedNoteId(note.id);
                },
                onDeleteNote: (noteId) => __async(null, null, function* () {
                  yield deleteNoteFromList(noteId);
                  if (selectedNoteId === noteId) {
                    setSelectedNoteId(null);
                  }
                }),
                onToggleStar: toggleNoteStar,
                activeNoteId: selectedNoteId,
                onSelectNote: (noteId) => setSelectedNoteId(noteId),
                courseCode,
                pageUrl,
                currentWeek: (_a = pageContext == null ? void 0 : pageContext.courseContext) == null ? void 0 : _a.week,
                onNoteEditingChange: setIsNoteEditing
              }
            )
          ]
        }
      )
    ] });
  }
  function createLockInSidebar(props) {
    let container = document.getElementById("lockin-root");
    if (!container) {
      container = document.createElement("div");
      container.id = "lockin-root";
      document.body.appendChild(container);
    }
    let currentProps = __spreadValues({}, props);
    const root = clientExports.createRoot(container);
    const render = () => {
      if (currentProps) {
        root.render(/* @__PURE__ */ jsxRuntimeExports.jsx(LockInSidebar, __spreadValues({}, currentProps)));
      }
    };
    render();
    return {
      root,
      unmount: () => {
        root.unmount();
        container == null ? void 0 : container.remove();
        currentProps = null;
      },
      updateProps: (newProps) => {
        if (currentProps) {
          currentProps = __spreadValues(__spreadValues({}, currentProps), newProps);
          render();
        }
      }
    };
  }
  if (typeof window !== "undefined") {
    window.LockInUI = {
      createLockInSidebar,
      LockInSidebar
    };
  }
  exports.createLockInSidebar = createLockInSidebar;
})(this.LockInUI = this.LockInUI || {});
//# sourceMappingURL=index.js.map
