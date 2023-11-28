export class TertiaryBox {
  constructor(defaultText) {
    this.box = document.createElement("div");
    this.box.id = "lifebar";
    this.box.style.padding = "6px 14px";
    this.box.style.top = "0";
    this.box.style.right = "0";
    this.box.style.position = "fixed";
    this.box.style.backgroundColor = "trasparent";
    this.box.style.color = "white";
    this.box.style.fontFamily = "sans-serif";
    this.box.style.fontSize = "26px";

    this.textnode = document.createTextNode(defaultText);
    this.box.appendChild(this.textnode);
    document.body.appendChild(this.box);
  }

  changeMessage(newText) {
    this.textnode.nodeValue = newText;
  }
  hide() {
    this.textnode.nodeValue = "";
    this.box.style.backgroundColor = "rgba(0,0,0,0)";
  }
  changeStyle(backcolor, fontColor, size = "26px", font = "sans-serif") {
    this.box.style.backgroundColor = backcolor;
    this.box.style.color = fontColor;
    this.box.style.fontFamily = font;
    this.box.style.fontSize = size;
  }
}
