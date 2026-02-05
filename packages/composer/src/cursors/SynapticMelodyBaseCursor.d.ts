import { ComposerCursor } from './ComposerCursor';
export declare abstract class SynapticMelodyBaseCursor extends ComposerCursor {
    protected _detune: number;
    protected _timbre: number;
    protected _pressure: number;
    protected _glide: boolean;
    isTie: boolean;
    expressionId: number;
    detune(val: number): this;
    timbre(val: number): this;
    pressure(val: number): this;
    expression(id: number): this;
    glide(enable?: boolean): this;
    tie(enable?: boolean): this;
}
//# sourceMappingURL=SynapticMelodyBaseCursor.d.ts.map