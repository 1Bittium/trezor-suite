import React, { useCallback, useState, ChangeEventHandler } from 'react';
import styled from 'styled-components';
import { AnimatePresence, HTMLMotionProps, motion } from 'framer-motion';
import { Range, Warning, useTheme, motionEasing } from '@trezor/components';
import { Translation } from '@suite-components';
import { useSelector, useActions, useAnonymityStatus } from '@suite-hooks';
import { AnonymityStatus } from '@suite-constants/coinjoin';
import { selectSelectedAccount } from '@wallet-reducers/selectedAccountReducer';
import * as coinjoinActions from '@wallet-actions/coinjoinAccountActions';

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;

const Slider = styled(Range)`
    margin-top: 0;
    cursor: pointer;
`;

const expandAnimation: HTMLMotionProps<'div'> = {
    initial: { height: 0, marginTop: 0, opacity: 0 },
    animate: { height: 48, marginTop: 24, opacity: 1 },
    exit: { height: 0, marginTop: 0, opacity: 0 },
    transition: {
        duration: 0.3,
        ease: motionEasing.transition,
    },
};

const minPosition = 0;
const maxPosition = 100;

const minValue = Math.log(1);
const maxValue = Math.log(100);

const scale = (maxValue - minValue) / (maxPosition - minPosition);

const getValue = (position: number) =>
    Math.round(Math.exp((position - minPosition) * scale + minValue));
const getPosition = (value: number) => minPosition + (Math.log(value) - minValue) / scale;

interface AnonymityLevelSliderProps {
    className?: string;
}

export const AnonymityLevelSlider = ({ className }: AnonymityLevelSliderProps) => {
    const currentAccount = useSelector(selectSelectedAccount);
    const { anonymityStatus, targetAnonymity } = useAnonymityStatus();

    const [sliderPosition, setSliderPosition] = useState(getPosition(targetAnonymity || 1));

    const { coinjoinAccountUpdateAnonymity } = useActions({
        coinjoinAccountUpdateAnonymity: coinjoinActions.coinjoinAccountUpdateAnonymity,
    });

    const theme = useTheme();

    const setAnonymity = useCallback(
        (number: number) => {
            if (!Number.isNaN(number)) {
                coinjoinAccountUpdateAnonymity(currentAccount?.key ?? '', getValue(number));
                setSliderPosition(number);
            }
        },
        [coinjoinAccountUpdateAnonymity, currentAccount?.key],
    );

    const handleSliderChange: ChangeEventHandler<HTMLInputElement> = useCallback(
        event => {
            const position = Number(event?.target?.value);

            setAnonymity(position);
        },
        [setAnonymity],
    );

    if (!currentAccount) {
        return null;
    }

    const trackStyle = {
        background: `\
            linear-gradient(270deg,\
                ${theme.GRADIENT_SLIDER_GREEN_START} 0%,\
                ${theme.GRADIENT_SLIDER_GREEN_END} 45%,\
                ${theme.GRADIENT_SLIDER_YELLOW_START} 55%,\
                ${theme.GRADIENT_SLIDER_YELLOW_END} 60%,\
                ${theme.GRADIENT_SLIDER_RED_END} 100%\
            );`,
    };

    const isErrorDisplayed = anonymityStatus === AnonymityStatus.Bad;

    return (
        <Container className={className}>
            <Slider
                value={sliderPosition}
                onChange={handleSliderChange}
                trackStyle={trackStyle}
                step="any"
                labels={[1, 3, 10, 30, 100]}
                onLabelClick={number => setAnonymity(getPosition(number))}
            />

            <AnimatePresence initial={!isErrorDisplayed}>
                {isErrorDisplayed && (
                    <motion.div {...expandAnimation}>
                        <Warning critical withIcon>
                            <Translation id="TR_ANONYMITY_LEVEL_BAD_WARNING" />
                        </Warning>
                    </motion.div>
                )}
            </AnimatePresence>
        </Container>
    );
};
