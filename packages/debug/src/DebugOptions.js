/**
 * Class for display a list of query string options
 * nicely in the console.
 * ### module: @springroll/debug
 * @class
 * @memberof springroll
 */
export default class DebugOptions {

    /**
     * Define a int query parameter.
     * @param {string} label The label for the options
     * @param {string} desc Description of values the option can accept
     * @static
     * @return {springroll.DebugOptions} instance of this DebugOptions for chaining
     */
    static int(label, desc) {
        return DebugOptions.add(label, DebugOptions.TYPES.INT, desc);
    }

    /**
     * Define a boolean query parameter
     * @param {string} label The label for the options
     * @param {string} desc Description of values the option can accept
     * @static
     * @return {springroll.DebugOptions} instance of this DebugOptions for chaining
     */
    static boolean(label, desc) {
        return DebugOptions.add(label, DebugOptions.TYPES.BOOLEAN, desc);
    }

    /**
     * Define a string query parameter
     * @param {string} label The label for the options
     * @param {string} desc Description of values the option can accept
     * @static
     * @return {springroll.DebugOptions} instance of this DebugOptions for chaining
     */
    static string(label, desc) {
        return DebugOptions.add(label, DebugOptions.TYPES.STRING, desc);
    }

    /**
     * Define a number query parameter
     * @param {string} label The label for the options
     * @param {string} desc Description of values the option can accept
     * @static
     * @return {springroll.DebugOptions} instance of this DebugOptions for chaining
     */
    static number(label, desc) {
        return DebugOptions.add(label, DebugOptions.TYPES.NUMBER, desc);
    }

    /**
     * Define a number query parameter
     * @param {string} label The label for the options
     * @param {string} type The type of value the option accepts
     * @param {string} [desc] Description of values the option can accept
     * @static
     * @return {springroll.DebugOptions} instance of this DebugOptions for chaining
     */
    static add(label, type, desc) {
        DebugOptions._maxLabel = Math.max(label.length, DebugOptions._maxLabel);
        DebugOptions._maxType = Math.max(type.length, DebugOptions._maxType);
        DebugOptions._options.push(
            {
                label: label,
                type: type,
                desc: desc
            });
        return DebugOptions;
    }

    /**
     * Build the log and final argument array for the
     * options output console.log();
     * @static
     */
    static log() {
        // The concatinated output string
        let output = DebugOptions.HEADER;

        // The CSS options to pass to console.log
        let css = [
            // The style for the header's text
            DebugOptions.CSS.HEADER,
            // A 'reset' CSS that prevents the color/size of the header
            // from leaking into the first option logged
            'display:none'
        ];

        // add the buffer to the max label
        // and type lengths
        DebugOptions._maxLabel += DebugOptions.COLUMN_BUFFER;
        DebugOptions._maxType += DebugOptions.COLUMN_BUFFER;
        let newLineSpacer = DebugOptions._spacer(DebugOptions._maxLabel + DebugOptions._maxType + DebugOptions.COLUMN_BUFFER);

        let option;
        let len = DebugOptions._options.length;

        for (let i = 0; i < len; i++) {
            option = DebugOptions._options[i];
            // tab label
            output += '\t%c' + DebugOptions._spacer(DebugOptions._maxLabel, option.label);
            // tab type
            output += '%c' + DebugOptions._spacer(DebugOptions._maxType, option.type);
            // null-string if no desc
            if (option.desc) {
                option.desc = option.desc.replace(
                    /(\r\n|\n|\r)/gm,
                    '\n' + newLineSpacer);
                output += ('%c' + option.desc);
            }
            // new line
            output += '\n';

            css.push(DebugOptions.CSS.LABEL, DebugOptions.CSS.TYPE);

            // only push the CSS for the description
            // if the description exists
            if (option.desc) {
                css.push(DebugOptions.CSS.DESC);
            }
        }

        // Send the console an argument list,
        // the first item is the entire formatted string of
        // options, with the 2nd onward args being all the CSS
        // in corresponding order with the %c formatting symbols
        // in the formatted string.
        console.log.apply(console, [output + '\n'].concat(css));
    }

    /**
     * Forget all the options that have been remembered
     * @static
     * @return {springroll.DebugOptions} instance of this DebugOptions for chaining
     */
    static reset() {
        DebugOptions._options.length = [];
        DebugOptions._maxLabel = 0;
        DebugOptions._maxType = 0;

        return DebugOptions;
    }

    /**
     * Generate a spacer slug. Returned object is concatenated
     * space character, i.e. ' ', to the specified count.
     * @private
     * @param {number} count How many characters the spacer needs
     * @param {string} str The input string to add spaces to
     * @return {string}
     */
    static _spacer(count, str) {
        if (str) {
            while (str.length < count) {
                str += ' '; //space
            }
        }
        else {
            str = ' '; //initial space is necessary?
            while (--count) {
                str += ' '; //space
            }
        }
        return str;
    }
}

/**
 * The space between columns
 * @member {number}
 * @private
 * @readOnly
 * @final
 */
DebugOptions.COLUMN_BUFFER = 4;

/**
 * The collections of options
 * @member {array}
 * @private
 */
DebugOptions._options = [];

/**
 * The maximum length of the label column
 * @member {array}
 * @private
 */
DebugOptions._maxLabel = 0;

/**
 * The maximum length of the type column
 * @member {array}
 * @private
 */
DebugOptions._maxType = 0;

/**
 * Config object for the CSS styles throughout
 * @member {object}
 * @private
 * @readOnly
 * @final
 */
DebugOptions.CSS = {
    HEADER: 'color: #FF4136; font-size: 1.2em; text-decoration:underline;', //orange-red color
    LABEL: 'color: #2ECC40;', //green
    TYPE: 'color: #0074D9;', //blue
    DESC: 'color: #FF851B' //orange
};

/**
 * The header for the final log
 * @member {string}
 * @private
 * @readOnly
 * @final
 */
DebugOptions.HEADER = '\n%cQuery Debug Options:\n%c';

/**
 * The map of different basic types of options.
 * @member {string}
 * @private
 * @readOnly
 * @final
 */
DebugOptions.TYPES = {
    INT: 'int',
    NUMBER: 'number',
    STRING: 'string',
    BOOLEAN: 'boolean'
};
