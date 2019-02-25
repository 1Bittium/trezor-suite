/* eslint-disable jsx-a11y/accessible-emoji */
/* @flow */
import * as React from 'react';
import styled from 'styled-components';
import colors from 'config/colors';
import { LANGUAGE } from 'config/variables';

import type { Props } from './Container';

const SelectWrapper = styled.div`
    display: flex;
    color: ${colors.WHITE};
    align-items: center;
`;

const SelectIcon = styled.span`
    padding: 0px 6px;
    margin-right: -38px;
`;

const StyledSelect = styled.select`
    height: 100%;
    padding-left: 32px;
    border: 0;
    background: transparent;
    cursor: pointer;
    appearance: none;
    border-radius: 0;
    overflow: visible;
    color: ${colors.WHITE};
`;


const LanguagePicker = ({ language, fetchLocale }: Props) => (
    <SelectWrapper>
        <SelectIcon role="img" aria-label="Select language">
            <svg width="32" height="24">
                <image xlinkHref={`l10n/flags/${language}.svg`} width="32" height="24" />
            </svg>
        </SelectIcon>
        <StyledSelect
            onChange={e => fetchLocale(e.target.value)}
            value={language}
        >
            {LANGUAGE.map(lang => (
                <option key={lang.code} label={lang.name} value={lang.code}>{lang.name}</option>
            ))}
        </StyledSelect>
    </SelectWrapper>
);

export default LanguagePicker;
