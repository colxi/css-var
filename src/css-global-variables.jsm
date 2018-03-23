/*
*
* @Author: colxi
* @Email: colxi.kl@gmail.com
* @Date:   2018-03-18 21:32:45
* @Last Modified by:   colxi
* @Last Modified time: 2018-03-23 03:02:30
* @License : GPL-3.0

*
* @Description : Returns a live collection, for easy manipulation (get & set)  top level (:root)
* CSS variables, simplifing the CSS based templating.
*
* Notes:
* - The '--' variable name prefix , is not required when setting or getting
* variables. It will be included automatically when ot provided. This feature
* provides a more natural  & fast coding.
* - The first time cssvar object is called, can generate a small delay, if the
* document has extensive CSS definitions.
*
* Limitations :
* - cssVar only operates with top level (:root) CSS Variables, any
* definition/overewritting done with another CSS slector will not be
* detected, and could affect the proper behavior of cssVar.
*
* Eg.
* <html>
*     <style/>
*         :root{
*             --main-color : #F2A2BB;
*             --textSize : 12;
*         }
*     </style>
*     <script>
*         // Note: Assuming css-var.js has been already attached to the docment
*
*         console.log ( cssVar['--main-color'] , cssVar.textSize );
*         // output : "#F2A2BB" , "12"
*
*         cssVar['--main-color'] = 'red';
*         cssVar.textSize = 20;
*         console.log ( cssVar['--main-color'], cssVar.textSize );
*         // output : "red" , "20"
*     </script>
* <html>
*
*
*/




'use strict';

export CSSGlobalVariables = (function(){
    // private ID counter
    let __identifierCounter__ = 0;

    /**
     * CSSGlobalVariables() : public constructor
     *
     * @param  {[type]} filterSelector [description]
     * @param  {[type]} autoPrefix     [description]
     * @param  {[type]} declareGlobal  [description]
     * @return {[type]}                [description]
     *
     */
    return function( filterSelector, autoPrefix, declareGlobal ){

        if( !(this instanceof CSSGlobalVariables) ) throw new Error('calling CSSGlobalVariables constructor without new is forbidden');

        /**
         *
         * [__config__ description]
         * @type {Object}
         *
         */
        const __config__ = {};

        /**
         *
         * __varsCache__ : Contains internally the CSS variables and values.
         * @type {Object}
         *
         */
        const __varsCache__ = {};


        /**
         *
         * [__constructor__ description]
         * @param  {[type]} declareGlobal  [description]
         * @param  {[type]} autoPrefix     [description]
         * @param  {[type]} filterSelector [description]
         *
         * @return {[type]}                [description]
         */
        function __constructor__( filterSelector, autoPrefix, declareGlobal ){
            // if filterSelector is an object , asume is configuration,
            // otherwhise fill the configuration object with the provided arguments
            if( typeof filterSelector === 'object' ) Object.assign( __config__, filterSelector );
            else{
                __config__.filterSelector = filterSelector;
                __config__.autoPrefix     = autoPrefix;
                __config__.declareGlobal  = declareGlobal;
            }
            // default values
            if( typeof __config__.filterSelector === 'undefined') __config__.filterSelector = false;
            if( typeof __config__.autoPrefix === 'undefined') __config__.autoPrefix = true;
            if( typeof __config__.declareGlobal === 'undefined') __config__.declareGlobal = '__cssGlobals__';

            // validate values
            if( typeof __config__.filterSelector !== 'string' && __config__.filterSelector !== false) throw new Error('"filterSelector" parameter must be a String or false');
            if( typeof __config__.autoPrefix !== 'boolean') throw new Error('"autoPrefix" parameter must be a Boolean');
            if( typeof __config__.declareGlobal !== 'string' && __config__.declareGlobal !== false) throw new Error('"declareGlobal" parameter must be a String or false');


            if( __config__.declareGlobal ){
                // Ensure the contents of the cache are up to date, when the cache object is
                // requested, using a getter.
                // It also declares the public window.cssVar reference, for user interaction

                Object.defineProperty( window , __config__.declareGlobal  , {
                    get : function(){
                        updateVarsCache();
                        return varsCacheProxy;
                    },
                    configurable : true
                });
            }

            if( __config__.filterSelector ){
                try{ document.querySelectorAll( __config__.filterSelector ) }
                catch(e){
                    throw new Error('Provided "filterSelector" is an invalid selector ("'+filterSelector+'")');
                }
            }

            __identifierCounter__++;
            __config__.id = __identifierCounter__;

            return;
        }


        /**
         *
         * varsCacheProxy (Proxy Object) : Public Proxy object containing the CSS
         * variables and their values. Provides bindeºd methods for live getting and
         * setting, the variables values.
         *
         * @type {Proxy Object}
         *
         */
        const varsCacheProxy = new Proxy( __varsCache__ , {
            get: function( target, name ){
                // check if there is any new CSS declarations to be considered
                // before returning any value
                updateVarsCache();
                name = normalizeVariableName( name );
                return Reflect.get(target,name);
            },
            set: function(target, name, value){
                updateVarsCache();
                name = normalizeVariableName( name );
                value = String(value);
                // set the variable value
                document.documentElement.style.setProperty( name, value );
                // update th cache object
                Reflect.set(target, name, value);
            },
            deleteProperty: function () {
                /* not allowed */
                updateVarsCache();
                return false;
            },
            ownKeys: function (target) {
                updateVarsCache();
                return Reflect.ownKeys(target);
            },
            has: function (target, name) {
                updateVarsCache();
                name = normalizeVariableName( name );
                return Reflect.has(target,name);
            },
            defineProperty: function (target, name, attr) {
                //
                // it only allows to set the value
                //
                updateVarsCache();
                name = normalizeVariableName( name );
                if( typeof attr==='object' && attr.hasOwnProperty('value') ){
                    let value = String(attr.value);
                    // set the CSS variable value
                    document.documentElement.style.setProperty( name , value );
                    // update the cache
                    Reflect.set(target, name, value);
                }
                return target;
            },
            getOwnPropertyDescriptor: function(target, name) {
                updateVarsCache();
                name = normalizeVariableName( name );
                return Reflect.getOwnPropertyDescriptor(target, name);
            }
        });

        /**
         *
         * [normalizeVariableName description]
         * @param  {[type]} name [description]
         *
         * @return {[type]}      [description]
         *
         */
        function normalizeVariableName( name = '' ){
            name = String(name);
            if( name.substring(0,2) !=='--' ){
                if(__config__.autoPrefix ) name = '--' + name;
                else throw new Error('Invalid CSS Variable name. Name must start with "--" (autoPrefix=false)');
            }
            return name;
        }


        /**
         *
         * updateVarsCache() : Updates the variables and values cache objec. Inspects
         * STYLE elements and attached stylesheets, ignoring those that have been
         * previously checked. Finally checks the inline CSS variables declarations.
         * Analized Elements will be Flagged wth the attribute data-css-var-cached
         *
         * @return {[boolean]} Returns true
         *
         */
        function updateVarsCache(){
            // iterate all CSS files attached to document, and extract all the
            // varibles set inside the :root selector
            [].slice.call(document.styleSheets).reduce( (prev,styleSheet)=>{
                // if filters have been provided to constructor...
                if( __config__.filterSelector ){
                    // get all style type elements, and ignore current if not
                    // been selected by the provided filter
                    let s = document.querySelectorAll( __config__.filterSelector );
                    let isSelected = false;
                    for( let i in s ) if( s.hasOwnProperty(i) && styleSheet.ownerNode === s[i] ){
                        isSelected = true;
                    }
                    if(!isSelected) return;
                }
                // if Style element has been previously analized ignore it, if
                // not mark element as analized to prevent future analysis
                let  ids = styleSheet.ownerNode.getAttribute('css-global-vars-id');

                if( String(ids).split(',').includes( String(__config__.id) ) ) return;
                else{
                    // not cached yet!
                    let value = styleSheet.ownerNode.getAttribute('css-global-vars-id');
                    // check if is null or empty (crossbrowser solution), and
                    // attach the new instance id
                    if( value === null || value === '' ) value = __config__.id;
                    else value += ',' + __config__.id;
                    // set the new value to the object
                    styleSheet.ownerNode.setAttribute('css-global-vars-id', value);
                }
                // iterate each CSS rule (if found)
                if (!styleSheet.cssRules) return;
                else return prev + [].slice.call(styleSheet.cssRules).reduce( (prev, cssRule)=>{
                    // select only the :root entries
                    if ( cssRule.selectorText === ':root' ) {
                        let css = cssRule.cssText.split( '{' );
                        css = css[1].replace( '}' , '' ).split( ';' );
                        // iterate each :root CSS property
                        for (let i = 0; i < css.length; i++) {
                            let prop = css[i].split(':');
                            // if is a varIABLE property, insert in in cache
                            if (prop.length === 2 && prop[0].indexOf('--') === 1){
                                __varsCache__[ prop[0].trim() ] = prop[1].trim();
                            }
                        }
                    }
                }, '');
            }, '');
            // After collecting all the variables definitions, check their computed
            // values, consulting the :root element inline style definitions,
            // and and assigning those values to the variables, in cache
            for( let p in __varsCache__){
                if( __varsCache__.hasOwnProperty(p) ){
                    __varsCache__[p] = window.getComputedStyle(document.documentElement,null).getPropertyValue(p).trim();
                }
            }
            // done !
            return true;
        }

        // call the constructor, analize the document style elements to generate
        // the collection of css variables, and return the proxy object
        __constructor__( filterSelector, autoPrefix, declareGlobal );
        updateVarsCache();
        return varsCacheProxy;
    };
})();