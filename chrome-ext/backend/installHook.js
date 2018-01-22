//  Created by Grant Kang, William He, and David Sally on 9/10/17.
//  Copyright © 2017 React Sight. All rights reserved.

/* eslint brace-style: off, camelcase: off, max-len: off, no-prototype-builtins: off, no-restricted-syntax: off, consistent-return: off, no-var: off */
// Notes... might need additional testing..renderers provides a list of all imported React instances
var __ReactSightHasRun; // memoize installing the hook
var __ReactSightDebugMode = true; // TODO change this to a node env param

if (!__ReactSightHasRun) {
  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) console.warn('[React-Sight]: React Sight requires React Dev Tools to be installed.');
  const reactInstances = window.__REACT_DEVTOOLS_GLOBAL_HOOK__._renderers || null;
  const instance = reactInstances[Object.keys(reactInstances)[0]];
  // const reactRoot = window.document.body.childNodes;
  const devTools = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  // grab the first instance of imported React library

  let __ReactSightThrottle = false;
  let __ReactSightFiberDOM;
  let __ReactSight_ReactVersion;
  let __ReactSightStore;

  // locate instance of __REACT_DEVTOOLS_GLOBAL_HOOK__
  // __REACT_DEVTOOLS_GLOBAL_HOOK__ exists if React is imported in inspected Window

  /**
   * Begin monkey patch
   *
   *  IF __REACT_DEVTOOLS_GLOBAL_HOOK__ NOT present, assume website is not using React
   *  IF React 16 detected, patch 'onCommitFiberRoot' from react dev tools
   *  ELSE Patch React 15 (or lowers) reconciler method
   */
  /*eslint-disable */
  (function installHook() {
    // no instance of React detected
    if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      if (__ReactSightDebugMode) console.warn('[React-Sight] Error: React DevTools not present. React Sight uses React DevTools to patch React\'s reconciler');
      return;
    }
    // React fiber (16+)
    if (instance && instance.version) {
      __ReactSight_ReactVersion = instance.version;
      if (__ReactSightDebugMode) console.log('version: ', __ReactSight_ReactVersion);
      devTools.onCommitFiberRoot = (function (original) {
        return function (...args) {
          __ReactSightFiberDOM = args[1];
          if (__ReactSightDebugMode) console.log('DOM: ', __ReactSightFiberDOM);
          traverse16();
          return original(...args);
        };
      })(devTools.onCommitFiberRoot);
    }
    // React 15 or lower
    else if (instance && instance.Reconciler) {
      // hijack receiveComponent method which runs after a component is rendered
      instance.Reconciler.receiveComponent = (function (original) {
        return function (...args) {
          if (!__ReactSightThrottle) {
            __ReactSightThrottle = true;
            setTimeout(() => {
              getData();
              __ReactSightThrottle = false;
            }, 10);
          }
          return original(...args);
        };
      })(instance.Reconciler.receiveComponent);
    }
    else console.log('[React Sight] React not found');
  })();
  /* eslint-enable */

  if (__ReactSightDebugMode) console.log('[React-Sight installed]]: ');

  /**
   * Strips name of function from component props
   *
   * @param {func} fn - function
   * @returns {string} function's name
   */
  const parseFunction = (fn) => {
    const string = `${fn}`;

    const match = string.match(/function/);
    if (match == null) return 'fn()';

    const firstIndex = match[0] ? string.indexOf(match[0]) + match[0].length + 1 : null;
    if (firstIndex == null) return 'fn()';

    const lastIndex = string.indexOf('(');
    const fnName = string.slice(firstIndex, lastIndex);
    if (!fnName.length) return 'fn()';
    return `${fnName} ()`;
  };

  /**
   * Parse Component's props. Handle nested objects and functions
   *
   * @param {object} props - Object representing a component's props
   */
  const parseProps = (props, i = 0) => {
    if (!props) return;
    if (props.hasOwnProperty(window) || props.hasOwnProperty('prevObject') || props.hasOwnProperty(Window)) return; // window was causing infinite loops
    if (typeof props !== 'object') return props;
    // check if current props has PROPS property..don't traverse further just grab name property
    // var hasBarProperty = Object.prototype.hasOwnProperty.call(foo, "bar");
    // if (props.hasOwnProperty('props')) {
    if (Object.prototype.hasOwnProperty.call(props, 'props')) {
      if (!props.hasOwnProperty('type')) return undefined;
      else if (props.type.hasOwnProperty('name') && props.type.name.length) return props.type.name;
      else if (props.type.hasOwnProperty('displayName') && props.type.displayName.length) return props.type.displayName;
      else if (props.hasOwnProperty('type')) return `${props.type}`;
    }

    else {
      const parsedProps = {};
      const keys = Object.keys(props);
      keys.forEach((key) => {
        // stringify methods
        if (typeof props[key] === 'function') parsedProps[key] = parseFunction(props[key]);
        // parseProps forEach element
        else if (Array.isArray(props[key]) && key === 'children') {
          parsedProps[key] = [];
          props[key].forEach((child) => {
            parsedProps[key].push(parseProps(child));
          });
        }
        // handle custom objects and components with one child
        else if (typeof props[key] === 'object') {
          if (props[key] && Object.keys(props[key]).length) {
            if (i < 3) { // limit how often this func can run -> was getting stuck in infinite loops
              const iterator = i + 1;
              parsedProps[key] = parseProps(props[key], iterator);
            } else parsedProps[key] = 'obj*'; // end recursion so we dont get infinite loops
          }
        }
        // handle text nodes and other random values
        else parsedProps[key] = props[key];
      });
      return parsedProps;
    }
  };

  /**
   * Recursively walk through virtual DOM and build up JSON representation
   *
   * @param {react component} component - a react component
   * @param {array} parentArr - array representing component's parent
   */
  const traverseAllChildren = (component, parentArr) => {
    // if no current element, return
    if (!component._currentElement) return;
    const newComponent = {
      children: [],
      id: null,
      name: 'default',
      state: null,
      props: null,
      ref: null,
      key: null,
    };
    // get ID
    if (component._debugID) newComponent.id = component._debugID;
    if (component._domID) {
      newComponent.id = component._domID;
      newComponent.isDOM = true;
    }
    else {
      newComponent.id = component._mountOrder * 100;
      newComponent.isDOM = false;
    }
    // Get Name
    if (component._currentElement.type) {
      // check for displayName or name
      if (component._currentElement.type.displayName) newComponent.name = component._currentElement.type.displayName;
      else if (component._currentElement.type.name) newComponent.name = component._currentElement.type.name;
      else newComponent.name = component._currentElement.type;
    }
    else newComponent.name = 'default';

    // call getState() on react-redux.connect()
    if (component._currentElement && component._currentElement.type && component._currentElement.type.propTypes && component._currentElement.type.propTypes.hasOwnProperty('store')) {
      __ReactSightStore = component._instance.store.getState();
    }

    // Get State
    if (!newComponent.state && component._instance && component._instance.state) {
      newComponent.state = component._instance.state;
      if (newComponent.state && Object.keys(newComponent.state).length === 0) {
        newComponent.state = null;
      }
    }
    if (!newComponent.props && component._currentElement && component._currentElement.props) {
      newComponent.props = parseProps(component._currentElement.props);
    }
    // Get key
    if (!newComponent.key && component._currentElement && component._currentElement.key) {
      newComponent.key = component._currentElement.key;
    }

    // Get component ref
    if (!newComponent.ref && component._currentElement && component._currentElement.ref) {
      newComponent.ref = component._currentElement.ref;
    }

    // go into children of current component
    const componentChildren = component._renderedChildren;
    parentArr.push(newComponent);
    if (componentChildren) {
      const keys = Object.keys(componentChildren);
      keys.forEach(key => traverseAllChildren(componentChildren[key], newComponent.children));
    }
    else if (component._renderedComponent) {
      traverseAllChildren(component._renderedComponent, newComponent.children);
    }
  };

  /**
   * Traverse React's virtual DOM and POST the object to the window.
   * The message will be recieved by React Sight chrome extension (the content script)
   *
   * @param {array} components - array containing parsed virtual DOM
   */
  const getData = (components = []) => {
    // define rootElement of virtual DOM
    const rootElement = instance.Mount._instancesByReactRootID[1]._renderedComponent;
    // recursively traverse down through props chain   starting from root element
    traverseAllChildren(rootElement, components);
    const data = { data: components, store: __ReactSightStore };
    const clone = JSON.parse(JSON.stringify(data));
    if (__ReactSightDebugMode) console.log('SENDING -> ', clone);
    window.postMessage(clone, '*');
  };

  /** TODO - get objects to work
   *
   * Parse the props for React 16 components
   */
  const props16 = (node) => {
    const props = {};
    const keys = Object.keys(node.memoizedProps);

    keys.forEach((prop) => {
      if (typeof node.memoizedProps[prop] === 'function') {
        props[prop] = parseFunction(node.memoizedProps[prop]);
      }
      // TODO - get these objects to work, almost always children property
      else if (typeof node.memoizedProps[prop] === 'object') {
        props[prop] = 'object*';

        // TODO - parse object
        // console.log('obj: ', node.memoizedProps[prop]);
        // if (node.memoizedProps[prop] && Object.keys(node.memoizedProps[prop]).length) {
        //   const keys = Object.keys(node.memoizedProps[props]);
        //   console.log('keys', keys)
        //   props[prop] = keys
        //   props[prop] = parseProps(node.memoizedProps[props]);
        // }
      }

      // TODO - debug this
      // else if (prop === 'children') {
      //   props[prop] = new node.memoizedProps[prop].constructor();
      //   if (Array.isArray(node.memoizedProps[prop])) {
      //     node.memoizedProps[prop].forEach((child) => {
      //       props[prop].push(child && child.type && child.type.name);
      //     });
      //   }
      //   else props[prop].name = node.memoizedProps[prop].type && node.memoizedProps[prop].type.name;
      // }
      else props[prop] = node.memoizedProps[prop];
    });
    return props;
  };

  /** TODO: Get Props
   *
   * Traverse through vDOM (React 16) and build up JSON data
   *
   */
  const recur16 = (node, parentArr) => {
    const newComponent = {
      name: '',
      children: [],
      state: null,
      props: null,
      id: null,
      isDOM: null,
    };

    // TODO ** only works on local host **
    // get ID
    if (node._debugID) newComponent.id = node._debugID;

    // get name and type
    if (node.type) {
      if (node.type.name) {
        newComponent.name = node.type.name;
        newComponent.isDOM = false;
      }
      else {
        newComponent.name = node.type;
        newComponent.isDOM = true;
      }
    }

    // get state
    if (node.memoizedState) newComponent.state = node.memoizedState;

    // get props
    if (node.memoizedProps) newComponent.props = props16(node);

    // get store
    if (node.type && node.type.propTypes && node.type.propTypes.hasOwnProperty('store')) __ReactSightStore = node.stateNode.store.getState();

    newComponent.children = [];
    parentArr.push(newComponent);
    if (node.child != null) recur16(node.child, newComponent.children);
    if (node.sibling != null) recur16(node.sibling, parentArr);
  };

  /**
   * Traversal Method for React 16
   *
   * If the application is using React Fiber, run this method to crawl the virtual DOM.
   * First, find the React mount point, then walk through each node
   * For each node, grab the state and props if present
   * Finally, POST data to window to be recieved by content-scripts
   *
   * @param {array} components - array containing parsed virtual DOM
   *
   */
  const traverse16 = (components = []) => {
    if (!__ReactSightFiberDOM) console.log('[ReactSight] virtual DOM not found, try triggering a setState()');
    if (__ReactSightDebugMode) console.log('[ReactSight] traverse16 vDOM: ', __ReactSightFiberDOM);
    recur16(__ReactSightFiberDOM.current.stateNode.current, components);
    const data = {
      data: components,
      store: __ReactSightStore,
    };
    data.data = data.data[0].children[0].children;
    if (__ReactSightDebugMode) console.log('[ReactSight] SENDING -> ', data);
    window.postMessage(JSON.parse(JSON.stringify(data)), '*');
  };

  // listener for initial load
  if (instance) {
    window.addEventListener('reactsight', () => {
      if (parseInt(__ReactSight_ReactVersion, 10) >= 16) traverse16();
      else getData();
    });
  }
  __ReactSightHasRun = true;
}
