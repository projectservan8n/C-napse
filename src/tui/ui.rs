//! UI rendering for the TUI

use super::app::{TuiApp, ToolStatus};
use crate::agents::MessageRole;
use ratatui::{
    prelude::*,
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap, Scrollbar, ScrollbarOrientation, ScrollbarState},
};

/// ASCII banner for the header
const ASCII_BANNER: &[&str] = &[
    r"  ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗",
    r" ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝",
    r" ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗  ",
    r" ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝  ",
    r" ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗",
    r"  ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝",
];

/// Draw the entire UI
pub fn draw(frame: &mut Frame, app: &TuiApp) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(8),  // ASCII Header
            Constraint::Min(5),     // Messages
            Constraint::Length(3),  // Input
            Constraint::Length(1),  // Status bar
        ])
        .split(frame.area());

    draw_header(frame, chunks[0], app);
    draw_messages(frame, chunks[1], app);
    draw_input(frame, chunks[2], app);
    draw_status(frame, chunks[3], app);
}

fn draw_header(frame: &mut Frame, area: Rect, app: &TuiApp) {
    let block = Block::default()
        .borders(Borders::BOTTOM)
        .border_style(Style::default().fg(Color::DarkGray));

    let inner = block.inner(area);
    frame.render_widget(block, area);

    // Build the banner lines
    let mut lines: Vec<Line> = Vec::new();

    for banner_line in ASCII_BANNER {
        lines.push(Line::from(Span::styled(
            *banner_line,
            Style::default().fg(Color::Cyan).bold(),
        )));
    }

    // Add status line below banner
    let status_line = format!(
        "                    {} │ {} {}",
        app.settings.get_default_provider(),
        app.settings.get_default_model(),
        if app.screen_watching { "│ 🖥️ Screen Watch ON" } else { "" }
    );
    lines.push(Line::from(Span::styled(
        status_line,
        Style::default().fg(Color::DarkGray),
    )));

    let banner = Paragraph::new(lines)
        .alignment(Alignment::Center);

    frame.render_widget(banner, inner);
}

fn draw_messages(frame: &mut Frame, area: Rect, app: &TuiApp) {
    let messages_block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::DarkGray))
        .title(" Chat ");

    let inner = messages_block.inner(area);
    frame.render_widget(messages_block, area);

    // Build message items
    let mut items: Vec<ListItem> = Vec::new();

    for msg in &app.messages {
        let (prefix, style) = match msg.role {
            MessageRole::User => ("You", Style::default().fg(Color::Green).bold()),
            MessageRole::Assistant => ("C-napse", Style::default().fg(Color::Cyan).bold()),
            MessageRole::System => ("System", Style::default().fg(Color::Yellow).italic()),
            MessageRole::Tool => ("Tool", Style::default().fg(Color::Magenta)),
        };

        // Time
        let time = msg.timestamp.format("%H:%M").to_string();

        // Header line
        let header_line = Line::from(vec![
            Span::styled(format!("{} ", prefix), style),
            Span::styled(time, Style::default().fg(Color::DarkGray)),
            if msg.is_streaming {
                Span::styled(" ●", Style::default().fg(Color::Yellow))
            } else {
                Span::raw("")
            },
        ]);

        items.push(ListItem::new(header_line));

        // Content lines (wrap long messages)
        let content_style = match msg.role {
            MessageRole::User => Style::default().fg(Color::White),
            MessageRole::Assistant => Style::default().fg(Color::White),
            MessageRole::System => Style::default().fg(Color::DarkGray),
            MessageRole::Tool => Style::default().fg(Color::Gray),
        };

        // Split content into lines and add wrapping
        for line in msg.content.lines() {
            items.push(ListItem::new(Line::from(Span::styled(
                format!("  {}", line),
                content_style,
            ))));
        }

        // Tool calls
        for tool in &msg.tool_calls {
            let status_icon = match tool.status {
                ToolStatus::Running => "⏳",
                ToolStatus::Success => "✓",
                ToolStatus::Failed => "✗",
            };
            let status_style = match tool.status {
                ToolStatus::Running => Style::default().fg(Color::Yellow),
                ToolStatus::Success => Style::default().fg(Color::Green),
                ToolStatus::Failed => Style::default().fg(Color::Red),
            };

            items.push(ListItem::new(Line::from(vec![
                Span::styled(format!("  {} ", status_icon), status_style),
                Span::styled(&tool.name, Style::default().fg(Color::Magenta)),
            ])));

            if let Some(result) = &tool.result {
                for line in result.lines().take(3) {
                    items.push(ListItem::new(Line::from(Span::styled(
                        format!("    {}", line),
                        Style::default().fg(Color::DarkGray),
                    ))));
                }
            }
        }

        // Empty line between messages
        items.push(ListItem::new(Line::from("")));
    }

    // Calculate scroll offset
    let total_items = items.len();
    let visible_height = inner.height as usize;
    let scroll_offset = if total_items > visible_height {
        total_items.saturating_sub(visible_height)
    } else {
        0
    };

    let list = List::new(items)
        .highlight_style(Style::default().add_modifier(Modifier::BOLD));

    // We need to skip items based on scroll
    frame.render_widget(list, inner);

    // Scrollbar
    if total_items > visible_height {
        let scrollbar = Scrollbar::default()
            .orientation(ScrollbarOrientation::VerticalRight)
            .begin_symbol(Some("↑"))
            .end_symbol(Some("↓"));

        let mut scrollbar_state = ScrollbarState::default()
            .content_length(total_items)
            .position(scroll_offset);

        frame.render_stateful_widget(
            scrollbar,
            area.inner(Margin {
                vertical: 1,
                horizontal: 0,
            }),
            &mut scrollbar_state,
        );
    }
}

fn draw_input(frame: &mut Frame, area: Rect, app: &TuiApp) {
    let input_block = Block::default()
        .borders(Borders::ALL)
        .border_style(if app.processing {
            Style::default().fg(Color::Yellow)
        } else {
            Style::default().fg(Color::Blue)
        })
        .title(if app.processing { " Processing... " } else { " Message " });

    let inner = input_block.inner(area);
    frame.render_widget(input_block, area);

    // Input text with cursor
    let input_text = if app.processing {
        "...".to_string()
    } else {
        app.input.clone()
    };

    let input = Paragraph::new(input_text)
        .style(Style::default().fg(Color::White))
        .wrap(Wrap { trim: false });

    frame.render_widget(input, inner);

    // Show cursor
    if !app.processing {
        frame.set_cursor_position(Position::new(
            inner.x + app.cursor_pos as u16,
            inner.y,
        ));
    }
}

fn draw_status(frame: &mut Frame, area: Rect, app: &TuiApp) {
    let status_text = format!(
        " {} │ Ctrl+C: Exit │ Ctrl+W: Toggle Screen Watch │ Enter: Send",
        app.status
    );

    let status = Paragraph::new(status_text)
        .style(Style::default().bg(Color::DarkGray).fg(Color::White));

    frame.render_widget(status, area);
}
