/**
 * Raw ESC/POS Command Builder for 80mm and 58mm Thermal Printers
 * Compatible with Epson, TVS, Rongta, Everycom, Posiflex, Xprinter, Citizen
 */

export interface EscPosOptions {
  paperWidth?: '80mm' | '58mm';
  autoCut?: boolean;
  openCashDrawer?: boolean;
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private charsPerLine: number;

  constructor(options: EscPosOptions = {}) {
    this.charsPerLine = options.paperWidth === '58mm' ? 32 : 48;
    this.init();
    if (options.openCashDrawer) {
      this.cashDrawer();
    }
  }

  public init(): this {
    // ESC @ (Initialize printer)
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  public alignLeft(): this {
    this.buffer.push(0x1b, 0x61, 0x00);
    return this;
  }

  public alignCenter(): this {
    this.buffer.push(0x1b, 0x61, 0x01);
    return this;
  }

  public alignRight(): this {
    this.buffer.push(0x1b, 0x61, 0x02);
    return this;
  }

  public bold(enable: boolean = true): this {
    this.buffer.push(0x1b, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  public sizeNormal(): this {
    this.buffer.push(0x1d, 0x21, 0x00);
    return this;
  }

  public sizeDoubleHeight(): this {
    this.buffer.push(0x1d, 0x21, 0x01);
    return this;
  }

  public sizeDoubleWidth(): this {
    this.buffer.push(0x1d, 0x21, 0x10);
    return this;
  }

  public sizeDoubleBoth(): this {
    this.buffer.push(0x1d, 0x21, 0x11);
    return this;
  }

  public feed(lines: number = 1): this {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  public text(str: string): this {
    // Replace non-ASCII / rupee symbol with ASCII approximation for ESC/POS
    const sanitized = str
      .replace(/₹/g, 'Rs. ')
      .replace(/•/g, '-')
      .replace(/[^\x00-\x7F]/g, '');

    for (let i = 0; i < sanitized.length; i++) {
      this.buffer.push(sanitized.charCodeAt(i));
    }
    return this;
  }

  public textLine(str: string = ''): this {
    this.text(str);
    this.feed(1);
    return this;
  }

  public divider(char: string = '-'): this {
    this.textLine(char.repeat(this.charsPerLine));
    return this;
  }

  public doubleDivider(): this {
    this.textLine('='.repeat(this.charsPerLine));
    return this;
  }

  public row(left: string, right: string): this {
    const cleanLeft = left.replace(/₹/g, 'Rs. ');
    const cleanRight = right.replace(/₹/g, 'Rs. ');
    const space = this.charsPerLine - cleanLeft.length - cleanRight.length;
    if (space <= 0) {
      this.textLine(cleanLeft);
      this.alignRight();
      this.textLine(cleanRight);
      this.alignLeft();
    } else {
      this.textLine(cleanLeft + ' '.repeat(space) + cleanRight);
    }
    return this;
  }

  public itemRow(name: string, qty: string, price: string, total: string): this {
    if (this.charsPerLine === 32) {
      // 58mm layout
      this.textLine(name);
      const rightPart = `${qty}x ${price}  ${total}`;
      const space = this.charsPerLine - rightPart.length;
      this.textLine(' '.repeat(Math.max(0, space)) + rightPart);
    } else {
      // 80mm layout (48 chars)
      // Name: 22, Qty: 8, Rate: 8, Total: 10
      const truncatedName = name.length > 22 ? name.substring(0, 20) + '..' : name;
      const col1 = truncatedName.padEnd(22, ' ');
      const col2 = qty.padStart(8, ' ');
      const col3 = price.padStart(8, ' ');
      const col4 = total.padStart(10, ' ');
      this.textLine(col1 + col2 + col3 + col4);
    }
    return this;
  }

  public cut(): this {
    this.feed(3);
    // GS V 66 0 (Feed and full cut)
    this.buffer.push(0x1d, 0x56, 0x42, 0x00);
    return this;
  }

  public cashDrawer(): this {
    // ESC p 0 25 250 (Pulse pin 2 / open cash drawer)
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  public toBuffer(): Buffer {
    return Buffer.from(this.buffer);
  }

  /**
   * Build complete printable receipt bytes from bill object
   */
  public static buildBillReceipt(bill: any, options: EscPosOptions = {}): Buffer {
    const builder = new EscPosBuilder(options);
    const org = bill.org || {};
    const shopName = org.name || 'FRIED ZONE';

    // Header
    builder.alignCenter().sizeDoubleHeight().bold(true);
    builder.textLine(shopName);
    builder.sizeNormal().bold(false);

    if (org.address?.line1) {
      builder.textLine(`${org.address.line1}, ${org.address.city || ''}`);
    }
    if (org.phone) {
      builder.textLine(`Tel: ${org.phone}`);
    }
    if (org.gstin) {
      builder.bold(true).textLine(`GSTIN: ${org.gstin}`).bold(false);
    }

    builder.divider();

    // Bill Meta
    builder.alignLeft();
    builder.row(`Bill: #${bill.billNumber}`, new Date(bill.createdAt || Date.now()).toLocaleDateString('en-IN'));
    if (bill.user?.name) {
      builder.row('Cashier:', bill.user.name);
    }
    if (bill.customerName && bill.customerName !== 'Walk-in Customer') {
      builder.row('Customer:', `${bill.customerName} ${bill.customerPhone ? `(${bill.customerPhone})` : ''}`);
    }

    builder.divider();

    // Table Header
    builder.bold(true);
    if (options.paperWidth === '58mm') {
      builder.textLine('ITEM / QTY / RATE / TOTAL');
    } else {
      builder.itemRow('ITEM', 'QTY', 'RATE', 'TOTAL');
    }
    builder.bold(false);
    builder.divider();

    // Items
    for (const it of bill.items || []) {
      const qty = `${it.quantity} ${it.unit || 'pcs'}`;
      const price = `Rs.${((it.unitPrice || 0) / 100).toFixed(2)}`;
      const total = `Rs.${((it.lineTotal || 0) / 100).toFixed(2)}`;
      builder.itemRow(it.productName, qty, price, total);
    }

    builder.divider();

    // Totals
    builder.alignLeft();
    builder.row('Subtotal:', `Rs.${((bill.subtotal || 0) / 100).toFixed(2)}`);

    if (bill.discountTotal > 0) {
      builder.row('Discount:', `-Rs.${((bill.discountTotal || 0) / 100).toFixed(2)}`);
    }

    // GST Breakdown (Rule 46 compliance)
    const taxTotal = bill.taxTotal || 0;
    if (taxTotal > 0) {
      const halfTax = Math.round(taxTotal / 2);
      builder.row('CGST (2.5%):', `Rs.${(halfTax / 100).toFixed(2)}`);
      builder.row('SGST (2.5%):', `Rs.${((taxTotal - halfTax) / 100).toFixed(2)}`);
    }

    builder.doubleDivider();
    builder.bold(true).sizeDoubleHeight();
    builder.row('GRAND TOTAL:', `Rs.${((bill.total || 0) / 100).toFixed(2)}`);
    builder.sizeNormal().bold(false);
    builder.divider();

    // Tender
    builder.row('Payment Mode:', String(bill.paymentMethod || 'CASH'));
    if (bill.paymentMethod === 'CASH' && bill.cashReceived) {
      builder.row('Cash Received:', `Rs.${(bill.cashReceived / 100).toFixed(2)}`);
      builder.row('Change Returned:', `Rs.${((bill.changeReturned || 0) / 100).toFixed(2)}`);
    }

    // Loyalty Points
    if (bill.pointsEarned > 0 || bill.pointsRedeemed > 0) {
      builder.divider();
      builder.alignCenter().bold(true);
      if (bill.pointsEarned > 0) {
        builder.textLine(`* Loyalty Points Earned: +${bill.pointsEarned} pts *`);
      }
      if (bill.pointsRedeemed > 0) {
        builder.textLine(`Points Redeemed: -${bill.pointsRedeemed} pts`);
      }
      if (bill.customer?.loyaltyPoints !== undefined) {
        builder.textLine(`Total Points Balance: ${bill.customer.loyaltyPoints} pts`);
      }
      builder.bold(false);
    }

    // Footer
    builder.divider();
    builder.alignCenter();
    builder.textLine(org.receiptFooter || 'Thank you for dining with us!\nPlease visit again.');

    if (options.autoCut !== false) {
      builder.cut();
    }

    return builder.toBuffer();
  }
}
