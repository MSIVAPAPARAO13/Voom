import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControlLabel,
    Switch,
    Button,
    Typography
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

export default function MeetingSettingsDialog({
    open = false,
    onClose,
    meetingSettings = {},
    onSettingsChange,
    onSaveSettings
}) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        bgcolor: '#0f172a',
                        color: '#f8fafc',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)'
                    }
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', pb: 2 }}>
                <SettingsOutlinedIcon sx={{ color: '#818cf8' }} />
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
                    Meeting Settings
                </Typography>
            </DialogTitle>

            <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <FormControlLabel
                    control={
                        <Switch
                            checked={meetingSettings.allowGuestAccess ?? true}
                            onChange={(e) => onSettingsChange({ ...meetingSettings, allowGuestAccess: e.target.checked })}
                            color="primary"
                        />
                    }
                    label={<Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 500 }}>Allow Guest Access</Typography>}
                />

                <FormControlLabel
                    control={
                        <Switch
                            checked={meetingSettings.waitingRoomEnabled ?? false}
                            onChange={(e) => onSettingsChange({ ...meetingSettings, waitingRoomEnabled: e.target.checked })}
                            color="primary"
                        />
                    }
                    label={<Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 500 }}>Enable Waiting Room</Typography>}
                />

                <FormControlLabel
                    control={
                        <Switch
                            checked={meetingSettings.allowChat ?? true}
                            onChange={(e) => onSettingsChange({ ...meetingSettings, allowChat: e.target.checked })}
                            color="primary"
                        />
                    }
                    label={<Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 500 }}>Allow In-Meeting Chat</Typography>}
                />

                <FormControlLabel
                    control={
                        <Switch
                            checked={meetingSettings.allowScreenShare ?? true}
                            onChange={(e) => onSettingsChange({ ...meetingSettings, allowScreenShare: e.target.checked })}
                            color="primary"
                        />
                    }
                    label={<Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 500 }}>Allow Screen Sharing</Typography>}
                />

                <FormControlLabel
                    control={
                        <Switch
                            checked={meetingSettings.allowParticipantUnmute ?? true}
                            onChange={(e) => onSettingsChange({ ...meetingSettings, allowParticipantUnmute: e.target.checked })}
                            color="primary"
                        />
                    }
                    label={<Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 500 }}>Allow Participants to Unmute</Typography>}
                />

                <FormControlLabel
                    control={
                        <Switch
                            checked={meetingSettings.allowRecording !== false}
                            onChange={(e) => onSettingsChange({ ...meetingSettings, allowRecording: e.target.checked })}
                            color="primary"
                        />
                    }
                    label={<Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 500 }}>Allow Meeting Recording</Typography>}
                />
            </DialogContent>

            <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', px: 3, py: 2 }}>
                <Button onClick={onClose} sx={{ color: '#94a3b8' }}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={onSaveSettings}
                    sx={{
                        bgcolor: '#4f46e5',
                        '&:hover': { bgcolor: '#4338ca' }
                    }}
                >
                    Save Changes
                </Button>
            </DialogActions>
        </Dialog>
    );
}
