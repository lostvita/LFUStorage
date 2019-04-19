/**
 * 工具库 
 */

export const clone = (obj) => {
    return JSON.parse(JSON.stringify(obj))
}

export const arr2Obj = (arr) => {
    return arr.reduce((acc, curr) => (
        acc[curr._id] = curr,acc
    )
    , {})
}

export const sizeof = (str, charset) => {
    if(!str) return 0
    let total = 0,
        i, len, charCode
    charset = charset ? charset.toLowerCase() : '';
    if(charset === 'utf-16' || charset === 'utf16') {
        for(i = 0, len = str.length; i < len; i++) {
            charCode = str.charCodeAt(i)
            if(charCode <= 0xffff){
                total += 2;
            }else{
                total += 4;
            }
        }
    } else {
        for(i = 0, len = str.length; i < len; i++){
            charCode = str.charCodeAt(i);
            if(charCode <= 0x007f) {
                total += 1;
            }else if(charCode <= 0x07ff){
                total += 2;
            }else if(charCode <= 0xffff){
                total += 3;
            }else{
                total += 4;
            }
        }
    }
    return total
}

export const warn = (str) => {
    console.warn(str)
}