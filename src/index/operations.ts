/* eslint-disable @typescript-eslint/naming-convention */
import { UNDEFINED_VARIABLE } from "./definitions";

export const OPERATORS = {
    'or': { precedence: 1, fn: _or },
    'OR': { precedence: 1, fn: _or },
    '||': { precedence: 1, fn: _or },
    'and': { precedence: 2, fn: _and},
    'AND': { precedence: 2, fn: _and},
    '&&': { precedence: 2, fn: _and},
    '|': { precedence: 3, fn: _bitwise_or },
    '^': { precedence: 4, fn: _xor },
    '&': { precedence: 5, fn: _bitsiwe_and },
    '!=': { precedence: 6, fn: _not_equals},
    'NE': { precedence: 6, fn: _not_equals},
    '==': { precedence: 6, fn: _equals },
    'EQ': { precedence: 6, fn: _equals },
    '<=': { precedence: 7, fn: _lessOrEquals },
    '>=': { precedence: 7, fn: _greaterOrEquals },
    '<': { precedence: 7, fn: _lessThan },
    '>': { precedence: 7, fn: _greaterThan },
    '+': { precedence: 8, fn: _plus },
    '-': { precedence: 8, fn: _subtract},
    '*': { precedence: 9, fn: _times },
    '/': { precedence: 9, fn: _division },
    '%': { precedence: 9, fn: _module },
    '!': { precedence: 10, fn: _not },
    'not': { precedence: 10, fn: _not },
    'NOT': { precedence: 10, fn: _not },
    '~': { precedence: 10, fn: _bitwiseNot },
    '<<': { precedence: 11, fn: _leftShift },
    '>>': { precedence: 11, fn: _rightShift },
    'in': { precedence: 12, fn: _in},
    'IN': { precedence: 12, fn: _in},
};



function boolToNumber(value: boolean): number {
    if (typeof value !== 'boolean') {
        return value;
    }
    return value ? 1 : 0;
}

function _in(x:any, y: any) {
    if (x === UNDEFINED_VARIABLE || y === UNDEFINED_VARIABLE) {
        return false;
    }
    if(typeof x === 'string'){
        x = x.replaceAll('"', '');
    }
    if(typeof y === 'string'){
        y = y.replaceAll('"', '');
        y = y.split(" ");
    }
    
    if(y.includes){
        return y.includes(x);
    }
    return false;
    
}

function _bitwiseNot(y:any, x: number) {
    if(validateSingle(x, 'number', '~')) {
        return ~x;
    }
    return false;
    
}

function _lessThan(x:any, y: any) {
    y = boolToNumber(y);
    x = boolToNumber(x);
    if(validate(x, y, 'number', '>')) {
        return x > y;
    }
    return false;
}

function _lessOrEquals(x:any, y: any) {
    y = boolToNumber(y);
    x = boolToNumber(x);
    if(validate(x, y, 'number', '<=')) {
        return x <= y;
    }
    return false;
}

function _greaterThan(x:any, y: any) {
    y = boolToNumber(y);
    x = boolToNumber(x);
    if(validate(x, y, 'number', '>')) {
        return x > y;
    }
    return false;
}

function _greaterOrEquals(x:any, y: any) {
    y = boolToNumber(y);
    x = boolToNumber(x);
    if(validate(x, y, 'number', '>=')) {
        return x >= y;
    }
    return false;
}

function _leftShift(x:any, y: any) {
    y = boolToNumber(y);
    x = boolToNumber(x);
    if(validate(x, y, 'number', '<<')) {
        return x << y;
    }
    false;
}

function _rightShift(x:any, y: any) {
    y = boolToNumber(y);
    x = boolToNumber(x);
    if(validate(x, y, 'number', '>>')) {
        return x >> y;
    }
    false;
}

function _times(x:any, y: any) {
    y = boolToNumber(y);
    x = boolToNumber(x);
    if(validate(x, y, 'number', '*')) {
        return x * y;
    }
    return false;
}

function _division(x:any, y: any) {
    y = boolToNumber(y);
    x = boolToNumber(x);
    if(validate(x, y, 'number', '/')) {
        if (y === 0) {
            throw new Error(`Invalid expression: Division by zero.`);
        }
        return x / y;
    }

    return false;
}

function _module(x:any, y: any) {
    y = boolToNumber(y);
    x = boolToNumber(x);



    if(validate(x, y, 'number', '%')) {
        if (y === 0) {
            throw new Error(`Invalid expression: Module by zero.`);
        }
        return x % y;
    }

    return false;
}

function _plus(x:any, y: any) {
    y = boolToNumber(y);
    x = boolToNumber(x);

    if(validate(x, y, 'number', '+')) {
        return x + y;
    }
    return false;
}

function _subtract(x:any, y: any) {
    y = boolToNumber(y);
    x = boolToNumber(x);
    if(validate(x, y, 'number', '-')) {
        return x - y;
    }
    return false;
}

function _xor(x:any, y: any) {
    y = boolToNumber(y);
    x = boolToNumber(x);
    if(validate(x, y, 'number', '^')) {
        return x ^ y;
    }
    return false;
    
}

function _bitwise_or(x:number, y: number) {
    
    if(validate(x, y, 'number', '|')) {
        return x | y;
    }
    return false;
    
}

function _bitsiwe_and(x:number, y: number) {
    if(validate(x, y, 'number', '&')) {
        return x & y;
    }
    return false;
    
}

function _equals(x:any, y: any) {
    if (x === UNDEFINED_VARIABLE || y === UNDEFINED_VARIABLE) {
        return false;
    }
    return x === y;
}

function _not_equals(x:any, y: any) {
    if (x === UNDEFINED_VARIABLE || y === UNDEFINED_VARIABLE) {
        return false;
    }
    return x !== y;
}

function _not(y:any, x: boolean) {
    if(validateSingle(x, 'boolean', 'not')) {
        return !x;
    }
    return false;
}

function _and(x:any, y: boolean) {
    if (validate(x, y, 'boolean', 'and')) {
        return x && y;
    }
    return false;
}

function _or(x:any, y: boolean) {
    
    if(validate(x, y, 'boolean', 'or')) {
        return x || y;
    }
    return false;


}

function validateSingle(x:any, expected:string, operator:string) { 
    if (x === UNDEFINED_VARIABLE) {
        return false;
    }
    if (typeof x !== expected) {
        throw new Error(`Invalid expression: This operator cannot be used in ${typeof x} expression: [${operator}].`);
    }
    return true;
}

function validate(x:any, y:any, expected:string, operator:string) {
    if (x === UNDEFINED_VARIABLE || y === UNDEFINED_VARIABLE) {
        return false;
    }
    if (typeof x !== expected || typeof y !== expected) {
        throw new Error(`Invalid expression: This operator cannot be used in ${typeof x} ${operator} ${typeof y} expression: [${operator}].`);
    }
    return true;
}
