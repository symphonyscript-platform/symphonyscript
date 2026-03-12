import type { Engine } from '@symphonyscript/dsp';

const MIDI_VELOCITY_MAX = 127;

function clamp(value: number, min: number, max: number): number {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

export function midiToUnitVelocity(vel: number): number {
    return clamp(vel, 0, MIDI_VELOCITY_MAX) / MIDI_VELOCITY_MAX;
}

export function routeNoteEvent(
    engine: Engine,
    channelId: number,
    pitch: number,
    velocity: number,
    gateOffset: number,
    expressionId: number
): void {
    engine.noteOn(
        channelId,
        pitch,
        midiToUnitVelocity(velocity),
        gateOffset,
        expressionId
    );
}

export function routeNoteOff(
    engine: Engine,
    channelId: number,
    pitch: number,
    expressionId: number
): void {
    engine.noteOff(channelId, pitch, expressionId);
}

export function routeCC(
    engine: Engine,
    channelId: number,
    controller: number,
    value: number
): void {
    engine.controlChange(channelId, controller, value);
}
