// Картинки уровней: небольшой набор рисовальных примитивов и сцены, собранные из них.
// Буквы - цвета из PALETTE (src/levels.ts), точка - пустое место. Чужие картинки в схему пикселей
// переводит scripts/image-to-level.ps1.

export class Canvas {
    readonly width: number;
    readonly height: number;
    private readonly cells: string[][];

    constructor(width: number, height: number, fill = '.') {
        this.width = width;
        this.height = height;
        this.cells = Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
    }

    put(x: number, y: number, color: string): this {
        if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
            this.cells[y][x] = color;
        }
        return this;
    }

    // закрашивает клетки, центр которых удовлетворяет условию
    private paint(color: string, inside: (x: number, y: number) => boolean): this {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (inside(x + 0.5, y + 0.5)) {
                    this.cells[y][x] = color;
                }
            }
        }
        return this;
    }

    // прямоугольник, границы включены
    rect(x0: number, y0: number, x1: number, y1: number, color: string): this {
        return this.paint(color, (x, y) => x >= x0 && x <= x1 + 1 && y >= y0 && y <= y1 + 1);
    }

    ellipse(cx: number, cy: number, rx: number, ry: number, color: string): this {
        return this.paint(color, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
    }

    disc(cx: number, cy: number, r: number, color: string): this {
        return this.ellipse(cx, cy, r, r, color);
    }

    ring(cx: number, cy: number, inner: number, outer: number, color: string): this {
        return this.paint(color, (x, y) => {
            const d = Math.hypot(x - cx, y - cy);
            return d > inner && d <= outer;
        });
    }

    poly(points: [number, number][], color: string): this {
        return this.paint(color, (x, y) => {
            let inside = false;
            for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
                const [xi, yi] = points[i];
                const [xj, yj] = points[j];
                if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
                    inside = !inside;
                }
            }
            return inside;
        });
    }

    line(x0: number, y0: number, x1: number, y1: number, color: string): this {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = 0; i <= steps; i++) {
            this.put(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), color);
        }
        return this;
    }

    // горизонтальные полосы от y0 до y1: цвета делят высоту поровну, сверху вниз
    bands(y0: number, y1: number, colors: string): this {
        for (let y = y0; y <= y1; y++) {
            const color = colors[Math.min(colors.length - 1, Math.floor(((y - y0) / (y1 - y0 + 1)) * colors.length))];
            this.rect(0, y, this.width - 1, y, color);
        }
        return this;
    }

    // точки в заданных местах
    dots(points: [number, number][], color: string): this {
        points.forEach(([x, y]) => this.put(x, y, color));
        return this;
    }

    rows(): string[] {
        return this.cells.map(r => r.join(''));
    }
}

export function sunset(): string[] {
    const c = new Canvas(26, 20);
    c.bands(0, 10, 'vvmmrrooyy');
    c.disc(13, 11, 4.6, 'y');
    c.bands(11, 19, 'oorrmmvvk');
    // дорожка солнца на воде
    for (let y = 11; y <= 18; y += 2) {
        c.rect(11, y, 15, y, y < 14 ? 'y' : 'o');
    }
    c.poly([[0, 11], [0, 8], [3, 9], [6, 11]], 'k');
    c.poly([[18, 16], [24, 16], [22.5, 17.8], [19.5, 17.8]], 'k');
    c.poly([[20.8, 10.5], [20.8, 15.6], [17.5, 15.6]], 'w');
    c.dots([[4, 3], [6, 2], [9, 4], [21, 4], [23, 3]], 'k');
    return c.rows();
}

export function sea(): string[] {
    const c = new Canvas(26, 20);
    c.bands(0, 9, 'sssssssbbb');
    c.disc(21, 4, 2.6, 'y');
    c.ellipse(7, 4, 4, 1.6, 'w').ellipse(10, 5, 3, 1.4, 'w').ellipse(15, 8, 3.5, 1.3, 'w');
    c.bands(10, 19, 'bbbbttttgg');
    c.poly([[6, 15], [16, 15], [14, 17.6], [8, 17.6]], 'n');
    c.rect(10, 6, 10, 15, 'n');
    c.poly([[11, 6], [11, 14.6], [16, 14.6]], 'w');
    c.poly([[9.4, 8], [9.4, 14.6], [5.6, 14.6]], 'r');
    c.poly([[10, 6], [10, 5], [12.5, 5.6]], 'y');
    c.dots([[20, 13], [22, 15], [3, 12], [18, 17], [23, 12]], 'w');
    return c.rows();
}

export function space(): string[] {
    const c = new Canvas(24, 24, 'k');
    c.disc(5, 20, 5, 'v').disc(8, 21, 3.4, 'm');
    // полосатая планета: полосы рисуются только внутри диска
    c.disc(8, 8, 5.4, 'o');
    c.rect(4, 6, 12, 6, 'y').rect(3, 9, 13, 10, 'r').rect(4, 12, 12, 12, 'y');
    c.disc(18, 17, 4.2, 'b').disc(17, 16, 1.6, 'g').disc(19.5, 18.5, 1.2, 'g');
    c.disc(19.5, 4.5, 2.2, 'a').dots([[19, 4], [20, 5]], 'w');
    c.dots([[1, 2], [4, 1], [12, 2], [14, 5], [22, 10], [2, 14], [12, 15], [22, 21], [13, 22], [10, 18]], 'w');
    c.dots([[16, 1], [23, 14], [1, 8], [11, 12]], 'y');
    return c.rows();
}

export function house(): string[] {
    const c = new Canvas(24, 22);
    c.bands(0, 13, 's');
    c.disc(3, 3.4, 2.2, 'y');
    c.ellipse(14, 3.5, 3.6, 1.4, 'w').ellipse(17, 4.5, 3, 1.3, 'w');
    c.bands(14, 21, 'lgggddgg');
    c.rect(6, 9, 16, 16, 'c');
    c.poly([[5, 9], [11, 3], [17, 9]], 'r');
    c.rect(14, 4, 15, 6, 'a');
    c.rect(10, 12, 12, 16, 'n').put(12, 14, 'y');
    c.rect(7, 11, 8, 12, 'b').rect(14, 11, 15, 12, 'b');
    c.poly([[10, 17], [13, 17], [15, 21], [8, 21]], 'c');
    c.rect(20, 12, 21, 16, 'n').disc(20.5, 9.6, 3.2, 'd').disc(20.5, 9, 2, 'g');
    c.dots([[2, 16], [3, 19], [5, 18], [18, 19], [22, 18], [1, 20]], 'p');
    c.dots([[4, 17], [19, 18], [21, 20]], 'y');
    c.dots([[2, 18], [17, 20]], 'r');
    return c.rows();
}

export function aquarium(): string[] {
    const c = new Canvas(24, 22);
    c.bands(0, 18, 'ssbbbbbbbbbbbtt');
    c.rect(0, 19, 23, 21, 'c');
    for (let y = 8; y <= 18; y++) {
        c.put(y % 2 === 0 ? 4 : 5, y, 'd').put(y % 2 === 0 ? 19 : 20, y - 2, 'g');
    }
    c.ellipse(10, 8, 3.6, 2.3, 'o').poly([[13, 8], [16.4, 5.4], [16.4, 10.6]], 'o').rect(10, 6, 10, 10, 'w').put(8, 7, 'k');
    c.ellipse(15, 15, 3.1, 2, 'y').poly([[12, 15], [9.4, 12.8], [9.4, 17.2]], 'y').put(16, 14, 'k');
    c.ellipse(5, 13, 2.2, 1.5, 'p').poly([[7, 13], [9, 11.6], [9, 14.4]], 'p').put(4, 12, 'k');
    c.dots([[3, 7], [4, 5], [3, 3], [13, 2], [14, 4], [20, 7], [21, 5], [8, 17]], 'w');
    c.disc(12, 20.2, 1.4, 'r').disc(18, 20.6, 1.1, 'm');
    return c.rows();
}

export function forest(): string[] {
    const c = new Canvas(26, 22);
    c.bands(0, 13, 'kkkkkvvvvb');
    c.disc(20.5, 5.5, 3, 'y').disc(21.8, 4.6, 1.2, 'c');
    c.dots([[2, 2], [6, 5], [9, 1], [12, 4], [15, 2], [3, 8], [10, 9], [16, 7], [24, 11]], 'w');
    c.ellipse(6, 17, 11, 5, 'd').ellipse(21, 16, 9, 4, 'd');
    c.bands(17, 21, 'gggdd').rect(0, 20, 25, 21, 'd');
    const tree = (x: number, top: number, color: string) => {
        c.poly([[x, top], [x - 3, top + 4.5], [x + 3, top + 4.5]], color);
        c.poly([[x, top + 2.5], [x - 4, top + 8], [x + 4, top + 8]], color);
        c.rect(x - 1, top + 8, x, top + 10, 'n');
    };
    tree(4, 7, 'g');
    tree(11, 5, 'd');
    tree(17, 8, 'g');
    tree(22, 6, 'd');
    c.dots([[8, 19], [14, 20], [19, 19], [1, 19]], 'r');
    return c.rows();
}

export function rainbow(): string[] {
    const c = new Canvas(26, 20, 's');
    // шесть дуг от внешней к внутренней, ширина дуги 1.4 клетки
    'rovygb'.split('').forEach((color, i) => c.ring(13, 18, 12 - (i + 1) * 1.4, 12 - i * 1.4, color));
    c.ellipse(4, 14, 3.6, 1.6, 'w').ellipse(7, 15, 3, 1.3, 'w').ellipse(21, 13, 3.4, 1.5, 'w').ellipse(23, 15, 2.6, 1.2, 'w');
    c.ellipse(13, 24, 20, 7.4, 'l').ellipse(13, 26, 22, 6, 'g').ellipse(3, 22, 8, 4, 'g');
    c.disc(22.5, 3, 2, 'y');
    c.dots([[6, 18], [10, 19], [17, 18], [21, 19], [14, 17]], 'p').dots([[4, 19], [12, 18], [19, 19]], 'y').dots([[8, 19], [16, 19]], 'r');
    return c.rows();
}

export function bouquet(): string[] {
    const c = new Canvas(22, 24, 'c');
    [[11, 17, 6, 8], [11, 17, 11, 5], [11, 17, 16, 9], [11, 17, 8, 13], [11, 17, 14, 13]].forEach(([x0, y0, x1, y1]) => c.line(x0, y0, x1, y1, 'g'));
    c.poly([[9, 15], [5, 13], [8, 17]], 'd').poly([[13, 15], [17, 13], [14, 17]], 'd');
    c.disc(6, 6.4, 3.4, 'y').disc(6, 6.4, 1.6, 'n');
    c.disc(11.5, 4.5, 2.9, 'r').disc(11.5, 4.5, 1.1, 'm');
    c.disc(16.5, 8, 2.7, 'p').disc(16.5, 8, 1, 'y');
    c.disc(8, 12.5, 2.4, 'v').disc(8, 12.5, 0.9, 'w');
    c.disc(14, 12.5, 2.4, 'o').disc(14, 12.5, 0.9, 'y');
    c.poly([[7.5, 17], [14.5, 17], [15.5, 23], [6.5, 23]], 'b');
    c.rect(7, 19, 15, 20, 'w').rect(7, 17, 15, 17, 't');
    return c.rows();
}

export function cat(): string[] {
    const c = new Canvas(24, 22, 't');
    c.poly([[4, 9], [5, 2], [10.5, 6.5]], 'o').poly([[13.5, 6.5], [19, 2], [20, 9]], 'o');
    c.poly([[5.6, 7], [6, 4.4], [8.6, 6.4]], 'p').poly([[15.4, 6.4], [18, 4.4], [18.4, 7]], 'p');
    c.ellipse(12, 12.5, 8.6, 7.6, 'o');
    c.rect(11, 6, 12, 8, 'n').rect(8, 6, 8, 7, 'n').rect(15, 6, 15, 7, 'n');
    c.ellipse(8.2, 11, 1.9, 2.3, 'g').ellipse(15.8, 11, 1.9, 2.3, 'g');
    c.rect(8, 10, 8, 12, 'k').rect(15, 10, 15, 12, 'k');
    c.ellipse(12, 16, 4.4, 3, 'w');
    c.poly([[11, 14], [13, 14], [12, 15.4]], 'p');
    c.line(12, 15, 12, 16, 'k').line(10, 17, 12, 16, 'k').line(14, 17, 12, 16, 'k');
    c.line(4, 15, 8, 15, 'w').line(4, 17, 8, 16, 'w').line(20, 15, 16, 15, 'w').line(20, 17, 16, 16, 'w');
    c.rect(5, 19, 18, 21, 'o');
    return c.rows();
}

export function city(): string[] {
    const c = new Canvas(28, 22);
    c.bands(0, 21, 'kkkkkvvvmm');
    c.disc(22, 5, 2.6, 'w').disc(23, 4.4, 1.2, 'a');
    c.dots([[2, 2], [5, 6], [9, 3], [13, 5], [16, 2], [19, 8], [26, 10], [1, 10]], 'w');
    const buildings: [number, number, number, string][] = [[0, 4, 11, 'a'], [5, 9, 6, 'k'], [10, 14, 9, 'a'], [15, 18, 4, 'k'], [19, 23, 10, 'a'], [24, 27, 7, 'k']];
    buildings.forEach(([x0, x1, top, color]) => {
        c.rect(x0, top, x1, 21, color);
        for (let y = top + 1; y <= 20; y += 2) {
            for (let x = x0 + 1; x <= x1 - 1; x += 2) {
                if ((x * 7 + y * 3) % 5 !== 0) {
                    c.put(x, y, 'y');
                }
            }
        }
    });
    c.rect(16, 1, 16, 3, 'a').put(16, 0, 'r');
    return c.rows();
}

export function butterfly(): string[] {
    const c = new Canvas(24, 20, 's');
    c.ellipse(6.5, 7, 5.6, 5, 'o').ellipse(17.5, 7, 5.6, 5, 'o');
    c.ellipse(7.5, 14, 4.4, 3.6, 'y').ellipse(16.5, 14, 4.4, 3.6, 'y');
    c.disc(6, 6.5, 2.2, 'r').disc(18, 6.5, 2.2, 'r').disc(6, 6.5, 0.9, 'w').disc(18, 6.5, 0.9, 'w');
    c.disc(7.5, 14, 1.4, 'm').disc(16.5, 14, 1.4, 'm');
    c.rect(11, 5, 12, 17, 'k').disc(12, 4.2, 1.5, 'k');
    c.line(11, 3, 8, 0, 'k').line(12, 3, 15, 0, 'k');
    c.dots([[7, 1], [3, 17], [20, 18], [2, 3], [21, 2]], 'w');
    return c.rows();
}

export function watermelon(): string[] {
    const c = new Canvas(26, 18, 'y');
    c.ellipse(13, 3, 12.6, 14.6, 'd').ellipse(13, 3, 11.6, 13.6, 'g').ellipse(13, 3, 10.4, 12.4, 'w').ellipse(13, 3, 9.4, 11.4, 'r');
    c.rect(0, 0, 25, 2, 'y');
    c.dots([[8, 5], [13, 6], [18, 5], [10, 9], [16, 9], [13, 12], [6, 8], [20, 8]], 'k');
    c.dots([[2, 15], [24, 16], [4, 4], [22, 3]], 'o');
    return c.rows();
}
