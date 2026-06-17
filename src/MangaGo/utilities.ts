export async function decryptImgSrcs(encrypted: string): Promise<string> {
    const keyBuffer = Buffer.from("e11adc3949ba59abbe56e057f20f883e", "hex");
    const ivBuffer = Buffer.from("1234567890abcdef1234567890abcdef", "hex");

    const cryptoKey = await crypto.subtle.importKey("raw", keyBuffer, { name: "AES-CBC" }, false, [
        "decrypt",
    ]);

    const binary = Application.base64Decode(encrypted) as unknown as ArrayBuffer;
    // console.log("Binary: " + binary);
    // const encryptedBytes = new Uint8Array(binaryStringToBytes(binary))

    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-CBC",
            iv: ivBuffer,
        },
        cryptoKey,
        binary,
    );

    // console.log(decrypted);

    // decrypted
    return new TextDecoder("utf-8").decode(decrypted);
}

export function decsojson4(jsf: string) {
    var head = "['sojson.v4']";
    if (jsf.indexOf(head) == -1) {
        return "Failed!\nGiven code is not encoded as Sojson v4.";
    }
    let args: any = jsf.substring(240, jsf.length - 58).split(/[a-zA-Z]{1,}/);
    var str = "";
    for (var i = 0; i < args.length; i++) {
        str += String.fromCharCode(args[i]);
    }
    return str;
}
