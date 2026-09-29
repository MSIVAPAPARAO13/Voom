import React, { useRef, useEffect } from 'react';
import {
    Box,
    Typography,
    IconButton,
    TextField,
    Button,
    Chip,
    Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import styles from '../../styles/videoComponent.module.css';

export default function ChatPanel({
    open = false,
    onClose,
    messages = [],
    message = "",
    onMessageChange,
    onSendMessage,
    allowChat = true,
    isHost = false,
    userData,
    editingMessageId,
    editingContent,
    onSetEditingContent,
    onStartEditMessage,
    onCancelEditMessage,
    onSaveEditedMessage,
    onDeleteMessage,
    onReactMessage,
    typingUsers = []
}) {
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom on new message
    useEffect(() => {
        if (open && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, open]);

    if (!open) return null;

    return (
        <aside
            className={styles.sideDrawer}
            aria-label="In-meeting chat panel"
        >
            {/* Header */}
            <div
                style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#0b1020'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                        In-Meeting Chat
                    </Typography>
                    <Chip
                        label={messages.length}
                        size="small"
                        sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            bgcolor: 'rgba(255, 255, 255, 0.08)',
                            color: '#94a3b8'
                        }}
                    />
                </Box>
                <IconButton
                    size="small"
                    onClick={onClose}
                    aria-label="Close chat panel"
                    sx={{ color: '#94a3b8', '&:hover': { color: '#ffffff', bgcolor: 'rgba(255, 255, 255, 0.1)' } }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </div>

            {/* Warning if Chat disabled by host */}
            {!allowChat && !isHost && (
                <Alert severity="warning" sx={{ m: 1.5, py: 0.5, fontSize: '0.78rem' }}>
                    Chat has been disabled by the meeting host.
                </Alert>
            )}

            {/* Messages Scroll Area */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}
            >
                {messages.length === 0 ? (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            opacity: 0.6,
                            textAlign: 'center',
                            px: 2
                        }}
                    >
                        <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 500 }}>
                            No messages yet
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5 }}>
                            Send a message to everyone in this meeting
                        </Typography>
                    </Box>
                ) : (
                    messages.map((item, index) => {
                        const isSelf = userData && (item.sender === userData?.id || item.sender === userData?.username || item.sender === userData?.name);
                        const senderDisplayName = item.senderName || item.sender || "Participant";
                        const timeStr = item.createdAt
                            ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : "";

                        return (
                            <div
                                key={item._id || index}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isSelf ? 'flex-end' : 'flex-start',
                                    width: '100%'
                                }}
                            >
                                {/* Sender & Timestamp line */}
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.75,
                                        mb: 0.4,
                                        px: 0.5
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontWeight: 600,
                                            fontSize: '0.72rem',
                                            color: isSelf ? '#818cf8' : '#cbd5e1'
                                        }}
                                    >
                                        {isSelf ? "You" : senderDisplayName}
                                    </Typography>
                                    {timeStr && (
                                        <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#64748b' }}>
                                            {timeStr}
                                        </Typography>
                                    )}
                                    {item.isEdited && !item.isDeleted && (
                                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                            (edited)
                                        </Typography>
                                    )}
                                </Box>

                                {/* Message Bubble or Inline Edit */}
                                {editingMessageId === item._id ? (
                                    <Box
                                        sx={{
                                            width: '100%',
                                            p: 1.5,
                                            bgcolor: '#1e293b',
                                            borderRadius: 2,
                                            border: '1px solid #4f46e5'
                                        }}
                                    >
                                        <TextField
                                            size="small"
                                            fullWidth
                                            multiline
                                            value={editingContent}
                                            onChange={e => onSetEditingContent(e.target.value)}
                                            onKeyPress={e => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    onSaveEditedMessage();
                                                }
                                            }}
                                            slotProps={{
                                                input: {
                                                    sx: { color: 'white', fontSize: '0.85rem' }
                                                }
                                            }}
                                        />
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                                            <Button size="small" onClick={onCancelEditMessage} sx={{ color: '#94a3b8' }}>
                                                Cancel
                                            </Button>
                                            <Button size="small" variant="contained" onClick={onSaveEditedMessage}>
                                                Save
                                            </Button>
                                        </Box>
                                    </Box>
                                ) : (
                                    <div className={isSelf ? styles.chatBubbleSelf : styles.chatBubbleRemote}>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontSize: '0.85rem',
                                                lineHeight: 1.4,
                                                fontStyle: item.isDeleted ? 'italic' : 'normal',
                                                opacity: item.isDeleted ? 0.7 : 1,
                                                wordBreak: 'break-word'
                                            }}
                                        >
                                            {item.message || item.data}
                                        </Typography>

                                        {/* Reactions display */}
                                        {item.reactions && item.reactions.length > 0 && (
                                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
                                                {Array.from(new Set(item.reactions.map(r => r.emoji))).map((emoji, rIdx) => {
                                                    const count = item.reactions.filter(r => r.emoji === emoji).length;
                                                    const userReacted = item.reactions.some(r => r.emoji === emoji && r.user === userData?.id);
                                                    return (
                                                        <Chip
                                                            key={rIdx}
                                                            label={`${emoji} ${count}`}
                                                            size="small"
                                                            clickable
                                                            onClick={() => onReactMessage && onReactMessage(item._id, emoji)}
                                                            sx={{
                                                                height: 20,
                                                                fontSize: '0.68rem',
                                                                bgcolor: userReacted ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                                                color: '#ffffff',
                                                                border: userReacted ? '1px solid #6366f1' : 'none'
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </Box>
                                        )}
                                    </div>
                                )}

                                {/* Hover/Active Actions: Quick reactions, Edit, Delete */}
                                {!item.isDeleted && !editingMessageId && (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.75,
                                            mt: 0.25,
                                            px: 0.5
                                        }}
                                    >
                                        {/* Quick Emoji React */}
                                        {userData && item._id && (
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                {['👍', '❤️', '😂', '🎉'].map(emoji => (
                                                    <span
                                                        key={emoji}
                                                        onClick={() => onReactMessage && onReactMessage(item._id, emoji)}
                                                        title={`React ${emoji}`}
                                                        style={{
                                                            cursor: 'pointer',
                                                            fontSize: '11px',
                                                            opacity: 0.6,
                                                            transition: 'opacity 0.15s ease'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                        onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                                                    >
                                                        {emoji}
                                                    </span>
                                                ))}
                                            </Box>
                                        )}

                                        {/* Edit Button */}
                                        {userData && item.sender === userData?.id && onStartEditMessage && (
                                            <IconButton
                                                size="small"
                                                onClick={() => onStartEditMessage(item)}
                                                sx={{ p: 0.2, color: '#94a3b8', '&:hover': { color: '#ffffff' } }}
                                                aria-label="Edit message"
                                            >
                                                <EditIcon sx={{ fontSize: 13 }} />
                                            </IconButton>
                                        )}

                                        {/* Delete Button */}
                                        {userData && (item.sender === userData?.id || isHost) && onDeleteMessage && (
                                            <IconButton
                                                size="small"
                                                onClick={() => onDeleteMessage(item._id)}
                                                sx={{ p: 0.2, color: '#94a3b8', '&:hover': { color: '#ef4444' } }}
                                                aria-label="Delete message"
                                            >
                                                <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                                            </IconButton>
                                        )}
                                    </Box>
                                )}
                            </div>
                        );
                    })
                )}

                {/* Typing Indicator */}
                {typingUsers && typingUsers.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                        <Box sx={{ display: 'flex', gap: 0.3 }}>
                            <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#818cf8', animation: 'pulse 1s infinite' }} />
                            <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#818cf8', animation: 'pulse 1s infinite 0.2s' }} />
                            <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#818cf8', animation: 'pulse 1s infinite 0.4s' }} />
                        </Box>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.72rem', fontStyle: 'italic' }}>
                            {typingUsers.map(u => u.username).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                        </Typography>
                    </Box>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar pinned to the bottom */}
            <div
                style={{
                    padding: '12px 14px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    background: '#0b1020',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                {!userData ? (
                    <Alert severity="info" sx={{ width: '100%', py: 0.25, fontSize: '0.75rem' }}>
                        Guests have read-only chat access.
                    </Alert>
                ) : (
                    <>
                        <TextField
                            size="small"
                            fullWidth
                            placeholder={!allowChat && !isHost ? "Chat is disabled" : "Type a message..."}
                            disabled={!allowChat && !isHost}
                            value={message}
                            onChange={onMessageChange}
                            onKeyPress={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    onSendMessage();
                                }
                            }}
                            slotProps={{
                                input: {
                                    sx: {
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '20px',
                                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.15)' },
                                        '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                                        '&.Mui-focused fieldset': { borderColor: '#6366f1' }
                                    }
                                }
                            }}
                        />
                        <IconButton
                            color="primary"
                            disabled={(!allowChat && !isHost) || !message.trim()}
                            onClick={onSendMessage}
                            aria-label="Send message"
                            sx={{
                                bgcolor: message.trim() ? '#4f46e5' : 'rgba(255, 255, 255, 0.05)',
                                color: '#ffffff',
                                '&:hover': {
                                    bgcolor: '#4338ca'
                                },
                                '&.Mui-disabled': {
                                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                                    color: 'rgba(255, 255, 255, 0.2)'
                                }
                            }}
                        >
                            <SendIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </>
                )}
            </div>
        </aside>
    );
}
